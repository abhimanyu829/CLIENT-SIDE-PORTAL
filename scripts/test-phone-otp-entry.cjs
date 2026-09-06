/* Test entry — loads .env, resolves "@/..." aliases, then loads the test. */
const path = require("path")
const fs = require("fs")
const Module = require("module")

// ── 1. Load .env BEFORE any module that reads process.env ─────────────────
const ROOT = path.resolve(__dirname, "..")
const envPath = path.join(ROOT, ".env")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && process.env[m[1]] === undefined) {
      let val = m[2]
      // dotenv-style quote stripping
      if (val.length > 1 && ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))) {
        val = val.slice(1, -1)
      }
      process.env[m[1]] = val
    }
  }
}
if (process.env.FORCE_OTP_DB_FALLBACK === "1") {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.REDIS_URL
}

// ── 2. Resolve "@/..." to the repo root ────────────────────────────────────
const EXTS = ["", ".ts", ".tsx", ".js", ".jsx", ".json", "/index.ts", "/index.tsx", "/index.js"]
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) {
    const base = path.join(ROOT, request.slice(2))
    for (const ext of EXTS) {
      const candidate = base + ext
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate
      }
    }
  }
  return originalResolve.call(this, request, ...args)
}

require("./test-phone-otp.ts")
