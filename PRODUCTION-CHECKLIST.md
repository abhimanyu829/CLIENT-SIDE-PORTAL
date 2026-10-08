# Agent Gateway — Production Deployment Checklist

**Before you turn on the agent gateway in production**, verify and fix every item below. This is the complete list of changes and checks needed based on the actual code.

---

## 🔴 CRITICAL — Must fix before production

### 1. Database migrations (BLOCKING)
**Status:** 7 migrations are written but NOT applied to production  
**Risk:** The gateway cannot start without these tables  
**Action:**
```bash
# On a machine with production DATABASE_URL and DIRECT_URL:
npx prisma migrate deploy
npx prisma migrate status  # must say "Database schema is up to date!"
```
**Verification:** `node scripts/agent-gateway-readiness.cjs` shows `OK migrations - all 7 applied`

---

### 2. Redis configuration (BLOCKING)
**Status:** Code requires Upstash Redis REST or a direct Redis connection  
**Risk:** Without Redis, **every agent call is refused** with 503 RATE_LIMITED (fail-closed behavior)  
**Action:**
- Upstash path (recommended): Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production `.env`
- Direct Redis path: Set `REDIS_URL=redis://host:port` with credentials if needed
- Also used for: nonces, webhook replay protection, sync-path idempotency, queue coordination

**Verification:** `node scripts/agent-gateway-readiness.cjs` shows `OK redis - answering`

---

### 3. Encryption key (BLOCKING)
**Status:** Required for agent credentials  
**Risk:** Agent tokens and signing secrets cannot be stored or retrieved  
**Action:**
```bash
# Generate once, never change it (existing credentials become unreadable):
openssl rand -base64 32
```
Set `ENCRYPTION_KEY=<output>` in production `.env`

**Verification:** readiness check shows `OK encryption`

---

### 4. Human approval SMS (BLOCKING for ASSISTED autonomy)
**Status:** Needs Twilio account  
**Risk:** Approval-gated operations hang forever if SMS codes cannot be sent  
**Action:**
1. Get Twilio credentials (account SID, auth token, phone number)
2. Set in production `.env`:
   ```
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...
   ```
3. In Prisma Studio, for every SUPER_ADMIN who will approve:
   - `phone` = their number in E.164 format (`+91XXXXXXXXXX`)
   - `phoneVerified` = today's date
   - `isBanned` = false

**Verification:** readiness check shows `OK sms` and `OK approvers - 2+ SUPER_ADMINs with a verified phone`

**Single point of failure warning:** If only 1 approver is configured, their phone/network failure blocks all approvals. Configure at least 2.

---

### 5. HTTPS enforcement & proxy setup (SECURITY)
**Status:** Code assumes nginx terminates TLS and forwards to the app  
**Risk:** Without HTTPS, agent tokens travel in plaintext  
**Current setup:**
- nginx (port 443) → Next.js app (internal port)
- `X-Real-IP` / `X-Forwarded-For` trusted from nginx only
- No `X-Forwarded-Proto` check in the gateway code (assumes TLS termination)

**Action:**
1. Verify nginx.conf forces HTTPS on the public endpoint
2. Verify `server_name` is `abhibhideveloper.online` or your production domain
3. Set `AGENT_GATEWAY_HOST` (optional, for health output only, never trusted for auth)
4. If you support multiple hosts (staging, etc.), set:
   ```
   AGENT_GATEWAY_MCP_ALLOWED_HOSTS=abhibhideveloper.online,staging.example.com
   AGENT_GATEWAY_MCP_ALLOWED_ORIGINS=https://abhibhideveloper.online,https://staging.example.com
   ```

**Verification:** `curl -I https://yoursite.com/api/agent-gateway/health` returns 200, never redirects to HTTP

---

### 6. Environment configuration (CRITICAL)
**Status:** Gateway ships OFF by default  
**Risk:** None (safe default), but you must turn it on deliberately  
**Required flags for production:**
```bash
AGENT_GATEWAY_ENABLED=1
AGENT_GATEWAY_MCP_ENABLED=1
AGENT_GATEWAY_TASKS_ENABLED=1           # if using async tasks
AGENT_GATEWAY_TRIGGERS_ENABLED=1        # if using schedules/webhooks
AGENT_GATEWAY_ENVIRONMENT=production    # MUST match connection environments
NODE_ENV=production
```

**DO NOT set these in production:**
- `AGENT_GATEWAY_CREDENTIAL_STORE=env` (dev bootstrap only, fails the readiness check)
- `AGENT_GATEWAY_SIGNING_ENABLED=1` unless you're actually using signed requests

**Optional tuning:**
- `AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE=60` (default)
- `AGENT_GATEWAY_RATE_LIMIT_PER_HOUR=1000` (default)
- `AGENT_GATEWAY_MAX_BODY_BYTES=262144` (256KB, default)
- `AGENT_GATEWAY_REQUEST_TIMEOUT_MS=30000` (30s, default)

**Verification:** Every flag listed in the readiness check matches your intent

---

### 7. Connection pool limits (DATABASE)
**Status:** Prisma default pool = `2 × CPU cores + 1` per instance  
**Risk:** Supabase session pooler caps at 15 connections → `EMAXCONNSESSION` errors  
**Action:**
- Option A: Add `connection_limit=5` to `DATABASE_URL` query string
- Option B: Use transaction pooler (port 6543, add `pgbouncer=true` to `DATABASE_URL`)
- Keep `DIRECT_URL` pointing at the direct connection (port 5432) for migrations

**Verification:** App logs never show `max clients are limited to pool_size: 15`

---

## 🟠 HIGH — Fix before agents operate on real data

### 8. Least-privilege connections
**Status:** No technical enforcement; policy only  
**Risk:** A compromised agent can do anything its connection is authorized for  
**Action:**
1. Create separate connections per agent/vendor
2. Grant only the capabilities they need (use the Governance → Policies page)
3. Set autonomy to ASSISTED first (requires human approval for writes)
4. Promote to LIMITED_AUTONOMY or FULL_AUTONOMY only after verification

**Review:** Does each connection follow least privilege? Could you revoke one without affecting the others?

---

### 9. Rollout controls (GRADUAL RELEASE)
**Status:** `AGENT_GATEWAY_ROLLOUT_ENFORCED` defaults to OFF  
**Risk:** OFF = every capability is visible to every connection immediately (legacy behavior)  
**Action:**
1. Once stable, set `AGENT_GATEWAY_ROLLOUT_ENFORCED=1`
2. Use Governance → Release to explicitly release each capability to:
   - DISABLED → INTERNAL (your own test connections)
   - INTERNAL → CANARY (select external agents)
   - CANARY → GENERAL (everyone)
3. Each stage has a health verdict; the system auto-pauses if the health check degrades

**Verification:** With enforcement ON and a capability at DISABLED, that capability is not in the agent's tool list

---

### 10. Kill switch drill
**Status:** Emergency stop exists, never tested in production  
**Risk:** In an incident, you won't know if it works  
**Action:**
1. Activate a GLOBAL kill switch (Governance → Release → Kill switches)
2. Verify an agent connection gets an empty tool list
3. Deactivate it
4. Verify the tools reappear

**Frequency:** Quarterly drill

---

### 11. Supply-chain integrity
**Status:** Code checks `lib/agent-gateway/capabilities/manifest.lock.json` on every request  
**Risk:** A malicious dependency could inject tools or change tool behavior  
**Action:**
1. After every `npm install` or dependency change, review the diff in `manifest.lock.json`
2. Never commit a manifest change without code review
3. CI should fail if the manifest fingerprint doesn't match the capability definitions

**Verification:** Test `p12-supply-chain.test.ts` passes

---

### 12. Approval limit per connection
**Status:** Live implementation caps at 20 pending approvals per connection  
**Risk:** Denial of service by flooding approval requests (e.g., 1000 writes with varying inputs)  
**Mitigation:** After 20 pending, new requests are refused with `APPROVAL_LIMIT_REACHED`  
**Action:** Monitor `agent_security_denial_total{reason="APPROVAL_LIMIT_REACHED"}` — a sustained spike means an agent is spamming

---

## 🟡 MEDIUM — Operational hygiene

### 13. Monitoring & alerts
**Metrics to watch:**
- `gateway_requests_total` (overall traffic)
- `gateway_auth_failure_total` (credential issues)
- `gateway_rate_limited_total` (capacity)
- `agent_security_denial_total{reason}` (includes kill switches, rollout blocks, approval spam)
- `agent_execution_total` (successful operations)
- `agent_kill_switch_block_total{scope}` (emergency stop activations)
- `agent_rollout_block_total{stage}` (gradual release blocks)

**Ledger queries:**
- `security.*` events (suspicious patterns)
- `rollout.auto_paused` (health degradation)
- `failure.circuit_opened` (capability-level failures)

**Alert on:**
- Auth failure rate > 10/min for 5 minutes (stolen credential?)
- Any `agent_kill_switch_block_total` (emergency stop was used)
- `rollout.auto_paused` (a release degraded and was auto-paused)

---

### 14. Audit chain verification
**Status:** Ledger is hash-chained to detect tampering  
**Risk:** A superuser with direct DB access can rewrite history  
**Action:**
1. Governance → Ledger → **Verify** button (runs the chain integrity check)
2. Schedule monthly verification
3. Save the verification result externally (e.g., in monitoring logs)

**Limitation:** Someone with `UPDATE` on the `AgentAuditEvent` table can rewrite the chain. The check detects it, but cannot prevent it.

---

### 15. Task & trigger retention
**Status:** Defaults keep tasks for 30 days, results for 7 days  
**Risk:** Storage growth if task volume is high  
**Action:**
- Adjust `AGENT_GATEWAY_TASK_RETENTION_MS` / `AGENT_GATEWAY_TASK_RESULT_RETENTION_MS` if needed
- Add a cron job or database policy to delete old rows
- Monitor `AgentTask` table size

---

### 16. Log & span redaction
**Status:** Pino redaction configured for common secret patterns  
**Risk:** A new log message may leak a credential if the field isn't in the redaction list  
**Action:**
- Review `lib/agent-gateway/observability/logger.ts` and `lib/agent-gateway/observability/tracing.ts`
- Add new field names to the redaction lists when you log new sensitive data
- Never log raw `Authorization` headers, bearer tokens, or signing secrets

**Verification:** Grep the logs for `agw_` (the token prefix) — nothing should match except startup diagnostics that show token existence (not the token itself)

---

## 🟢 RECOMMENDED — Before scale

### 17. Worker concurrency
**Status:** Default 5 concurrent tasks per worker  
**Risk:** Too low = tasks queue up; too high = database connection exhaustion  
**Action:**
- Start with default (`AGENT_GATEWAY_TASK_WORKER_CONCURRENCY=5`)
- Increase if task queue depth stays high under normal load
- Monitor `AgentTask` rows in `QUEUED` state

---

### 18. Backup & disaster recovery
**Action:**
1. Database backups that include the agent tables:
   - `AgentConnection`, `AgentCredential`, `AgentPolicy*`, `AgentAutonomy`, `AgentApproval*`, `AgentTask`, `AgentTrigger*`, `AgentAuditEvent`, `AgentRecovery`, `AgentRollout`, `AgentKillSwitch`
2. Test restore
3. Note that credentials are encrypted: a backup without `ENCRYPTION_KEY` cannot recover them
4. Document the process for rotating a leaked `ENCRYPTION_KEY` (spoiler: very hard; all credentials must be reissued)

---

### 19. Rate limit tuning
**Status:** 60 req/min, 1000 req/hour per connection (defaults)  
**Risk:** Legitimate agents may be throttled; attackers may stay under the limit  
**Action:**
- Start with defaults
- If an agent legitimately exceeds them, raise the limits or give it a second connection
- Monitor `gateway_rate_limited_total` by connectionId

---

### 20. Signed request auth (optional)
**Status:** Bearer tokens are always supported; HMAC signing is opt-in  
**Risk:** Bearer tokens can be replayed until revoked; signed requests have single-use nonces  
**When to enable:**
- High-security agents
- Compliance requirement for non-replayable credentials

**Action:**
1. Set `AGENT_GATEWAY_SIGNING_ENABLED=1`
2. Create connections with `authMethod: SIGNED_REQUEST`
3. The agent signs each request with HMAC-SHA256 over `method|path|timestamp|nonce|body`
4. The nonce is checked against Redis and refused if seen before

**Trade-off:** More complex agent code; requires Redis (already required)

---

## 📋 Pre-deployment smoke test (local)

Run these against the production build **before** deploying:

```bash
# Build with production config
NODE_ENV=production npm run build

# Start the production server (port 3100 to avoid colliding with dev)
NODE_ENV=production npx next start -p 3100

# 1. Health check
curl http://localhost:3100/api/agent-gateway/health
# expect: 200 {"status":"ok",...}

# 2. Gateway is off (until you turn it on)
curl -X POST http://localhost:3100/api/agent-gateway/mcp \
  -H "Authorization: Bearer fake-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# expect: 503 {"error":{"code":"GATEWAY_DISABLED",...}}

# 3. Governance pages render (sign in as SUPER_ADMIN first)
# Visit these in the browser:
#   /admin/agent-governance
#   /admin/agent-governance/connections
#   /admin/agent-governance/policies
#   /admin/agent-governance/approvals
#   /admin/agent-governance/release
#   /admin/agent-governance/ledger
# All should render without errors (empty is fine).

# 4. Readiness check
node scripts/agent-gateway-readiness.cjs
# expect: "READY: 0 blocking, 0 warning(s)"
```

---

## 🚦 Go-live sequence (once smoke tests pass)

Follow this order. **Do not skip steps.**

1. **Backup** the production database (or note the point-in-time recovery timestamp).

2. **Apply migrations:**
   ```bash
   npx prisma migrate deploy
   npx prisma migrate status  # "Database schema is up to date!"
   ```

3. **Deploy the code** with all gateway flags **off** (the default). The gateway remains disabled; only the human-route fixes take effect.

4. **Verify the smoke tests above** on the live site (health endpoint, governance pages).

5. **Turn on the gateway gradually:**
   - Set `AGENT_GATEWAY_ENABLED=1`, `AGENT_GATEWAY_MCP_ENABLED=1`, `AGENT_GATEWAY_ENVIRONMENT=production`
   - Restart the app
   - Verify `GET /api/agent-gateway/health` returns 200 with `gatewayEnabled: true`

6. **Create one test connection** (internal, for your own testing).

7. **Run the approval drill:**
   - Set that connection to ASSISTED autonomy
   - Call `tickets.create` via MCP
   - Approve it as a SUPER_ADMIN (SMS step-up code)
   - Verify the ticket is created
   - Reject a second request; verify it's refused

8. **Enable rollout enforcement** (recommended but optional):
   - Set `AGENT_GATEWAY_ROLLOUT_ENFORCED=1`, restart
   - On Governance → Release, set each capability to INTERNAL
   - Verify your test connection sees them
   - Advance to CANARY, then GENERAL after health checks pass

9. **Create production agent connections** for real vendors/customers.

10. **Promote autonomy one level at a time:** ASSISTED → LIMITED_AUTONOMY → FULL_AUTONOMY, only after verification at each level.

---

## ⚠️ Known limitations & residual risks

From the threat model (`docs/agent-gateway/phase-12/01-threat-model.md`):

1. **A compromised agent can still do anything its connection is authorized for.** Mitigation: least privilege + approvals, not detection.
2. **Prompt injection detection is advisory only.** The gate always re-evaluates authorization, regardless of what the model "believes".
3. **Content-trust declarations** per capability must be accurate (reviewed via manifest lock).
4. **A superuser with direct DB access can rewrite the audit ledger.** The chain verification detects tampering but cannot prevent it.
5. **The human product route** (`/api/products/[slug]`) returns non-published products (pre-existing issue, outside the agent surface).
6. **Ticket route** shows assigned staff email to the customer (noted, not changed).
7. **Guest reviews:** one review per product from the shared guest author (pre-existing).

---

## 📚 Full documentation

- Deployment steps: `docs/agent-gateway/deployment-runbook.md`
- Threat model: `docs/agent-gateway/phase-12/01-threat-model.md`
- Release controls: `docs/agent-gateway/phase-15/08-production-readiness.md`
- Known issues resolved: `docs/agent-gateway/known-issues-resolution.md`
- Local testing guide: *(you already have this from the previous answer)*

---

## ✅ Final gate: all of these must be TRUE

- [ ] All 7 migrations applied (`npx prisma migrate status` confirms)
- [ ] Upstash Redis answering (`node scripts/agent-gateway-readiness.cjs` shows OK redis)
- [ ] `ENCRYPTION_KEY` set and never changing
- [ ] Twilio configured; ≥2 SUPER_ADMINs with verified phones
- [ ] nginx forces HTTPS on the public endpoint
- [ ] `AGENT_GATEWAY_ENVIRONMENT=production`, `NODE_ENV=production`
- [ ] Database connection pool tuned (added `connection_limit` or using transaction pooler)
- [ ] Production build smoke tests all pass (health, governance pages, readiness check)
- [ ] One live approval drill completed successfully
- [ ] Monitoring alerts configured (auth failures, kill switches, rollout pauses)
- [ ] Monthly audit chain verification scheduled
- [ ] Backup & restore tested

**When all checkboxes are ticked, the gateway is production-ready.**
