# Phase 15 — 03 Canary

- Audience: the INTERNAL cohort plus a deterministic share of all connections.
- Bucket: `sha256(connectionId ‖ 0x00 ‖ capabilityId)`, first 4 bytes, `mod 100`. Stable for a connection and capability (no flapping between calls), independent across capabilities (one connection is not the canary for everything), not influenced by anything an agent sends.
- Size: 1–50 %. Wider exposure is GENERAL, which has its own gates. The distribution is tested over 2 000 synthetic connections (25 % → 20–30 %).
- Health: while a rollout is INTERNAL or CANARY, the maintenance pass evaluates its health gate and pauses it automatically when UNHEALTHY (`04`, `07`).
- Promotion to GENERAL: never automatic; an operator advances it, guarded by health and (production) an attestation.

Proof: `p15-release-controls` A (bucket stability and spread), D (canary admission matches the bucket), `p15-release-service` H.
