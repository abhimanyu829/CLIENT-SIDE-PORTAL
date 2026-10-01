#!/usr/bin/env node
/**
 * scripts/agent-gateway-readiness.cjs - READ-ONLY pre-flight for enabling the
 * agent gateway in an environment. Run it with that environment's variables:
 *
 *   node scripts/agent-gateway-readiness.cjs
 *
 * It loads .env (without overriding variables already set), then checks:
 *   1. migrations: every local migration is recorded as finished in the
 *      database, and no failed (unresolved) migration blocks `migrate deploy`;
 *   2. Redis: configured and answering (the gateway's rate limiter fails
 *      closed without it, so the gateway refuses every call);
 *   3. secrets: ENCRYPTION_KEY present (agent credentials are encrypted);
 *   4. human approval: SMS (Twilio) configured, and at least one active
 *      SUPER_ADMIN with a verified phone (approvals need an SMS step-up code);
 *   5. the gateway feature flags, for review.
 *
 * It only runs SELECT queries and a Redis PING; it never writes, and it never
 * prints secret values (only whether they are set). Exit code 1 when a
 * blocking check fails, 0 otherwise (warnings do not fail).
 */
const path = require("path")
const fs = require("fs")

const ROOT = path.resolve(__dirname, "..")

function loadDotEnv() {
  const file = path.join(ROOT, ".env")
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m || process.env[m[1]] !== undefined) continue
    let value = m[2]
    if (value.length > 1 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) value = value.slice(1, -1)
    process.env[m[1]] = value
  }
}

const results = []
const report = (level, name, detail) => {
  results.push({ level, name })
  console.log(`${level.padEnd(5)} ${name}${detail ? ` - ${detail}` : ""}`)
}
const isSet = (name) => typeof process.env[name] === "string" && process.env[name].trim() !== ""
const flag = (name) => (isSet(name) ? process.env[name] : "(unset)")
/** First meaningful line of an error (Prisma messages start with a blank line). */
const firstLine = (err) => String(err?.message ?? err).split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "unknown error"

async function checkMigrations(prisma) {
  const dir = path.join(ROOT, "prisma", "migrations")
  const local = fs.readdirSync(dir).filter((d) => /^\d{14}_/.test(d) && fs.existsSync(path.join(dir, d, "migration.sql"))).sort()
  let rows
  try {
    rows = await prisma.$queryRawUnsafe('SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations"')
  } catch (err) {
    report("FAIL", "migrations", `cannot read _prisma_migrations: ${firstLine(err)}`)
    return
  }
  const finished = new Set(rows.filter((r) => r.finished).map((r) => r.migration_name))
  const failed = [...new Set(rows.filter((r) => !r.finished && !r.rolled_back).map((r) => r.migration_name))].filter((name) => !finished.has(name))
  const pending = local.filter((name) => !finished.has(name))
  if (failed.length > 0) {
    report("FAIL", "migrations", `failed and unresolved (blocks migrate deploy): ${failed.join(", ")} - see docs/agent-gateway/deployment-runbook.md`)
  }
  if (pending.length > 0) report("FAIL", "migrations", `${pending.length} not applied: ${pending.join(", ")} - run: npx prisma migrate deploy`)
  else report("OK", "migrations", `all ${local.length} applied`)
}

async function checkApprovers(prisma) {
  try {
    // User.phoneVerified is the verification timestamp (null = not verified),
    // the same truthiness the approval step-up checks (approvals/decision-service.ts).
    const approvers = await prisma.user.count({ where: { role: "SUPER_ADMIN", isBanned: false, phoneVerified: { not: null }, NOT: { phone: null } } })
    if (approvers === 0) report("FAIL", "approvers", "no active SUPER_ADMIN has a verified phone: approval-gated agent operations can never be approved")
    else if (approvers === 1) report("WARN", "approvers", "exactly one SUPER_ADMIN can approve (single point of failure)")
    else report("OK", "approvers", `${approvers} SUPER_ADMINs with a verified phone`)
  } catch (err) {
    report("FAIL", "approvers", `query failed: ${firstLine(err)}`)
  }
}

async function checkRedis() {
  const restConfigured = isSet("UPSTASH_REDIS_REST_URL") && isSet("UPSTASH_REDIS_REST_TOKEN")
  if (!restConfigured && !isSet("REDIS_URL")) {
    report("FAIL", "redis", "not configured: the gateway rate limiter fails closed and refuses every agent call")
    return
  }
  try {
    const { Redis } = require("@upstash/redis")
    const redis = restConfigured
      ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
      : new Redis({ url: process.env.REDIS_URL, token: "" })
    const pong = await Promise.race([redis.ping(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout after 5s")), 5000))])
    report(pong === "PONG" ? "OK" : "FAIL", "redis", pong === "PONG" ? "answering" : `unexpected reply: ${String(pong)}`)
  } catch (err) {
    report("FAIL", "redis", `configured but not answering: ${firstLine(err)}`)
  }
}

async function main() {
  loadDotEnv()
  console.log("Agent gateway readiness (read-only)\n")

  if (!isSet("DATABASE_URL")) {
    report("FAIL", "database", "DATABASE_URL is not set")
  } else {
    const { PrismaClient } = require("@prisma/client")
    const prisma = new PrismaClient()
    try {
      await checkMigrations(prisma)
      await checkApprovers(prisma)
    } finally {
      await prisma.$disconnect().catch(() => undefined)
    }
  }

  await checkRedis()

  report(isSet("ENCRYPTION_KEY") ? "OK" : "FAIL", "encryption", isSet("ENCRYPTION_KEY") ? "ENCRYPTION_KEY is set" : "ENCRYPTION_KEY is not set (required in production)")

  const sms = isSet("TWILIO_ACCOUNT_SID") && isSet("TWILIO_AUTH_TOKEN") && isSet("TWILIO_PHONE_NUMBER")
  report(sms ? "OK" : "FAIL", "sms", sms ? "Twilio account, token and sender number are set" : "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER missing: approval step-up codes cannot be sent")

  // The env-JSON credential store is a local-development bootstrap only.
  const production = process.env.AGENT_GATEWAY_ENVIRONMENT === "production" || process.env.NODE_ENV === "production"
  if (process.env.AGENT_GATEWAY_CREDENTIAL_STORE === "env") {
    report(production ? "FAIL" : "WARN", "credential store", "AGENT_GATEWAY_CREDENTIAL_STORE=env (development bootstrap); unset it to use the database store")
  } else {
    report("OK", "credential store", "database-backed (default)")
  }

  console.log("\nFlags (review before enabling):")
  for (const name of ["AGENT_GATEWAY_ENABLED", "AGENT_GATEWAY_MCP_ENABLED", "AGENT_GATEWAY_TASKS_ENABLED", "AGENT_GATEWAY_TRIGGERS_ENABLED", "AGENT_GATEWAY_ENVIRONMENT", "AGENT_GATEWAY_ROLLOUT_ENFORCED", "AGENT_GATEWAY_SIGNING_ENABLED", "AGENT_GATEWAY_CREDENTIAL_STORE"]) {
    console.log(`      ${name} = ${flag(name)}`)
  }

  const failures = results.filter((r) => r.level === "FAIL").length
  const warnings = results.filter((r) => r.level === "WARN").length
  console.log(`\n${failures === 0 ? "READY" : "NOT READY"}: ${failures} blocking, ${warnings} warning(s)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(`readiness check crashed: ${err.message}`)
  process.exit(1)
})
