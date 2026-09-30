# Phase 0 — Dangerous Primitive Audit

Full-codebase search performed for: raw SQL execution, shell execution, `eval`/`new Function`, arbitrary HTTP proxy/fetch, admin/service-role credential exposure, generic CRUD/mutation endpoints. Nothing below was modified.

## eval / dynamic code execution
**None found.** No `eval(`, no `new Function(`.

## Shell / child process execution
**None found** in application code. (One `exec(` match in `components/shared/RichTextEditor.tsx` is `document.execCommand()`, a browser API for rich-text formatting — unrelated to shell execution, not a primitive risk.)

## Raw SQL (`$executeRaw` / `$queryRaw` / `*Unsafe` variants)

| File | Function/Purpose | Access level | Risk | AI exposure |
|---|---|---|---|---|
| `migrate.js` | One-off dev migration script (enum `ALTER TYPE` statements) | Dev-only, not runtime code | Low (not reachable from any request path) | DO NOT EXPOSE (not a runtime capability at all) |
| `scripts/sync-enterprise-schema.ts` | One-off schema patch script | Dev-only, not runtime code | Low | DO NOT EXPOSE |
| `jobs/embedding.job.ts` | `db.$executeRaw` — parameterized tagged-template UPDATE for pgvector embedding columns | Worker process, fixed query shape | Low (parameterized, not string-concatenated) | DO NOT EXPOSE as a generic tool; the *outcome* (embeddings updated) is not itself an exposed capability today |
| `app/api/ai/recommendations/route.ts` | `db.$queryRaw` — parameterized tagged-template pgvector similarity search | User-facing route | Low (parameterized, fixed shape, read-only) | Could become a scoped READ tool (`recommendations.get`) in a later phase — but must remain the fixed query, never accept a raw SQL fragment |
| `app/api/health/route.ts` | `db.$queryRaw\`SELECT 1\`` | Health check | None (no user input) | N/A — infrastructure check, not a business capability |

**Conclusion: no generic "run any SQL" endpoint exists anywhere.** Every raw-SQL usage is a fixed, hardcoded query shape with parameterized (not string-concatenated) inputs. None matches the explicitly-forbidden `database.query(sql)` pattern from the architecture spec.

## Generic object-mutation / CRUD endpoints — the one real finding

**`app/api/admin/service-discovery/[id]/route.ts` (PATCH handler).**
- Accepts an `entity` string (`"campaign" | "collection" | "tag"`) and an arbitrary `data` object from the request body.
- For the `"campaign"` case specifically: `const data = body?.data ?? {}` is passed directly to `db.serviceDiscoveryCampaign.update({ where: { id }, data })` — **no zod schema, no field allowlist**.
- Auth is present and correct (`admin()` helper checks `SUPER_ADMIN`/`SUB_ADMIN`), so this is not an unauthenticated vulnerability.
- **Risk: NOT_CRITICAL** (scoped to one non-financial, non-identity model — marketing campaign metadata — already behind admin auth) but **explicitly flagged: DO NOT EXPOSE AS AN AGENT TOOL AS-IS.** Any adapter wrapping this capability must introduce a field allowlist (an `inputSchema` narrower than "any Prisma-valid field") before it could ever become `discovery.updateCampaign` as a scoped tool.

**`app/api/admin/revalidate/route.ts`** — accepts arbitrary `tags[]`/`paths[]` strings from an admin-authenticated caller and calls `revalidateTag`/`revalidatePath` directly. Low risk (cache-only, no data mutation, no financial/PII exposure), but still unscoped input. If ever exposed as a tool, would need a fixed allowlist of valid tag names rather than accepting arbitrary strings.

No other generic "any field, any entity" mutation endpoint was found in the codebase.

## Service-role keys / admin DB credentials in code
**None found** hardcoded in `lib/` or `app/`. All secrets are environment-variable-sourced (`.env`, correctly gitignored). No `SUPABASE_SERVICE_ROLE`-style key or raw DB admin password appears in any TypeScript source file.

## Arbitrary URL fetch / SSRF-shaped endpoints
**None found.** No route accepts a user-supplied URL and performs a server-side fetch against it. The one `fetch()` call matching a proxy-shaped pattern (`app/(admin)/admin/orders/OrdersClient.tsx`) is client-side code calling the app's own `/api/admin/orders/export` endpoint — not a server-side proxy.

## Minor code-quality flag (not a security vulnerability)
`stores/authStore.ts` has client-side Zustand logic `if (user.role === "ADMIN") return true // admins bypass all` — `"ADMIN"` is not a valid `Role` enum value, so this check never fires. It is purely cosmetic client state (the server always independently re-checks via `requireAdmin`/`requireRole`), so it is **not** an authorization bypass in practice, but it is the same class of stale-role-string bug found in the tickets/projects routes (see BUG-BASELINE.md) and should be cleaned up in a future maintenance pass.

## Summary verdict

No primitive in this codebase requires "DO NOT EXPOSE" treatment for security-critical reasons (no arbitrary SQL, no shell, no eval, no credential leakage). The one operational finding (`service-discovery` generic update) requires an adapter with field-level validation before any future exposure — this is a normal, expected Phase 1 adapter-design task, not evidence of a pre-existing vulnerability being actively exploitable today (it is already admin-auth-gated).
