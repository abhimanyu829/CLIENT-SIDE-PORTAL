# Phase 0 — Data Sensitivity Matrix

Categories: PUBLIC, INTERNAL, CONFIDENTIAL, SENSITIVE, HIGHLY_SENSITIVE.

| Data | Category | Read by | Mutate by | AI exposure | Redaction required for AI |
|---|---|---|---|---|---|
| Product catalog metadata (name, description, public price) | PUBLIC | Anyone | Admin (Products:EDIT) | Yes, freely | None |
| Product `deliveryConfig` (may contain provisioning secrets) | HIGHLY_SENSITIVE | Admin (decrypted via `lib/encryption.ts`) | Admin | **Never raw** — only non-secret deployment metadata (`DEPLOYMENT_META_KEYS`) may ever be exposed, and only via the existing `resolveDeliveryMeta()` extraction, never the raw decrypted blob | Full — secrets must never leave the encryption boundary |
| `PurchasedService.config` (customer credentials: password/temporaryPassword/dbPassword) | HIGHLY_SENSITIVE | Admin (`GET config` route, decrypted for display) | Admin (`updateServiceConfig`, AES-256-GCM encrypted at rest) | **Never** | Full — this is customer-facing production credentials |
| User PII (email, name, phone) | SENSITIVE | Admin, self | Admin, self | Read: scoped-to-self or admin-with-justification only; never bulk export to an AI context | Mask email/phone in any AI-facing read unless the specific capability is explicitly a "look up this one customer" tool with strict resource-scoping |
| Payment/billing details (amount, gateway IDs, invoices) | SENSITIVE | Admin, owning user | System (webhooks), Admin (refund) | Read: yes for aggregate/analytics; per-record: only scoped to a specific, admin-authorized lookup | Never expose gateway secret keys or raw webhook payloads |
| `SubadminAccount` credentials (password hash, access token hash, session tokens) | HIGHLY_SENSITIVE | Nobody in plaintext (all hashed) | SUPER_ADMIN only | **Never** | N/A — already hashed, but the *existence/management* of accounts is itself CRITICAL-tier and blocked |
| `AuditLog` / `SubadminActivityLog` entries | INTERNAL | Admin | Nobody (append-only) | Read: yes, valuable for an AI "what happened" query — but before/after JSON snapshots may themselves contain SENSITIVE fields (e.g. a `beforeJson` capturing a user's old email) — redact at the field level, not just at the log-access level | Field-level redaction on `beforeJson`/`afterJson` if the captured entity had sensitive fields |
| Subscription/Ticket/Lead records | INTERNAL/CONFIDENTIAL | Admin, owning user | Admin, owning user (partial) | Yes, scoped to specific record with resource-ownership check enforced identically to human access | None beyond existing ownership scoping |
| Environment variables / secrets (`.env`, `ENCRYPTION_KEY`, gateway API keys) | HIGHLY_SENSITIVE | Server process only | Deploy-time only | **Never** — no tool should ever read or return env var values | N/A — must be architecturally unreachable, not just policy-blocked |
| `ENCRYPTION_KEY`-derived plaintext (any `decrypt()` call result) | HIGHLY_SENSITIVE | Whatever code path calls `decrypt()` | N/A | **Never** returned to an agent, regardless of capability | Any adapter wrapping `updateServiceConfig`/delivery-config reads must strip decrypted values before returning to the tool-call boundary |

## Redaction principle for Phase 1+

Any future MCP tool's `outputSchema` must be defined narrower than the underlying Prisma model — never "return the whole row." This is not yet implemented (Phase 0 does not build it) but is a hard requirement flagged here because several existing admin routes (e.g. `GET /api/admin/deployment-center/[id]/config`) currently return decrypted config directly to the admin UI — that pattern is correct for a human admin session but must **not** be reused verbatim as an agent-facing tool without a redaction layer in between.
