/**
 * scripts/refresh-manifest-lock.ts
 *
 * Regenerates lib/agent-gateway/capabilities/manifest.lock.json from the live
 * core capability manifest using the SAME pure functions the supply-chain test
 * uses (summarizeManifest + manifestFingerprint). Deterministic: canonical
 * sorted output, order-independent fingerprint. Reviewed tooling — the lock is
 * never hand-edited.
 *
 * Usage: npx tsx scripts/refresh-manifest-lock.ts [--check]
 *   --check  exit 1 if the on-disk lock differs (CI-friendly), without writing.
 */
import { readFileSync, writeFileSync } from "fs"
import path from "path"
import { CORE_CAPABILITY_MANIFEST } from "../lib/agent-gateway/capabilities/manifest"
import {
  MANIFEST_SUMMARY_VERSION,
  manifestFingerprint,
  summarizeManifest,
} from "../lib/agent-gateway/capabilities/manifest-summary"

const LOCK_PATH = path.resolve("lib/agent-gateway/capabilities/manifest.lock.json")

const next = {
  summaryVersion: MANIFEST_SUMMARY_VERSION,
  fingerprint: manifestFingerprint(CORE_CAPABILITY_MANIFEST),
  capabilities: summarizeManifest(CORE_CAPABILITY_MANIFEST),
}

const rendered = `${JSON.stringify(next, null, 2)}\n`
const check = process.argv.includes("--check")

if (check) {
  const current = JSON.parse(readFileSync(LOCK_PATH, "utf8")) as typeof next
  const same =
    current.summaryVersion === next.summaryVersion &&
    current.fingerprint === next.fingerprint &&
    JSON.stringify(current.capabilities) === JSON.stringify(next.capabilities)
  if (!same) {
    console.error("manifest.lock.json is STALE — run: npx tsx scripts/refresh-manifest-lock.ts")
    process.exit(1)
  }
  console.log("manifest.lock.json is up to date")
} else {
  writeFileSync(LOCK_PATH, rendered, "utf8")
  console.log(
    `manifest.lock.json refreshed: ${next.capabilities.length} capabilities, fingerprint ${next.fingerprint.slice(0, 16)}…`,
  )
}