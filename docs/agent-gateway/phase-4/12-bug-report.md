# Phase 4 — Bug Report

## Methodology

Implement -> unit test -> service integration test -> end-to-end test -> failure test -> security test -> data-integrity test -> regression test -> inspect every failure -> reproduce independently -> determine root cause -> classify (P0-P3, and PHASE-4 INTRODUCED / PHASE-3 CONTRACT ISSUE / PHASE-2 ISSUE / PRE-EXISTING / OUT-OF-SCOPE) before editing any code.

## Bugs found and fixed this phase

**None.** All 77 new Phase 4 tests passed on their first run, across every category (unit, service integration, end-to-end, security, data integrity). This differs from Phase 2 (2 bugs: a raw-Error-leak and a shallow-freeze mutability gap) and Phase 3 (2 bugs: the same two classes of issue) — attributable to Phase 4 reusing Phase 2/3's already-hardened `CapabilityError`/registry patterns directly rather than re-implementing similar logic from scratch, and to the Step 0 audit surfacing every real contract mismatch (see below) BEFORE any code was written, rather than discovering them via test failures afterward.

## Contract mismatches found during the Step 0 audit (classified as PHASE-3 CONTRACT ISSUE, not a Phase 4 bug — resolved via adapter-level translation, not a registry edit)

These are pre-existing gaps between Phase 3's declared capability contracts and the real backend's actual behavior, discovered during Phase 4's mandatory audit (see `04-existing-service-mapping.md` for full detail). None were "fixed" by editing Phase 3's manifest (out of scope for Phase 4 — a manifest change would be a Phase 3 concern and risks breaking Phase 3's own already-passing test suite); instead, each adapter explicitly rejects the unsupported input with a clear `INVALID_INPUT` error rather than silently ignoring it or attempting to implement a filter the real service never had.

1. **`products.list`'s `status` filter**: Phase 3 declares it as a free-form optional string; the real service (`app/api/products/route.ts`) always forces `status: "AVAILABLE"` and has no other supported value. Classification: P3 (minor contract-precision gap, no security/correctness impact since the adapter's rejection is strictly safer than silently ignoring the filter). Resolution: documented + explicit `INVALID_INPUT` rejection in `ProductsListAdapter`.
2. **`products.list`'s `category` filter**: Phase 3 declares it; the real service has NO category filter at all (filters by `type`, not `category`). Classification: P3, same rationale. Resolution: same pattern.
3. **`products.list`'s `limit` max**: Phase 3 declares max 100; the real service caps at 50. Classification: P3 (no security impact; adapter honors the TIGHTER existing cap, which is the safe direction to diverge in). Resolution: `Math.min(input.limit ?? 12, 50)` in the adapter.

None of these three required a P0/P1/P2 fix — they are pre-existing Phase 3 contract-precision gaps, explicitly out of scope for Phase 4 to correct in the registry itself (that would be Phase 3 work, done in a different phase's commit), and are safely handled at the adapter boundary by rejecting rather than silently misbehaving.

## Architectural finding, not a bug (classified as PRE-EXISTING, out of scope to fix)

**`products.createDraft` and `coupons.create` cannot execute today** because their real implementations (`createProduct`, `createCoupon` Server Actions) depend on `requireAdmin()`, which requires a real Clerk human session and has no service-principal/delegation mechanism anywhere in this codebase. This is a **pre-existing architectural gap** in the main application (not something Phase 1/2/3/4 introduced) — the codebase has never had a way to invoke an admin-gated Server Action as a non-human, non-interactive caller. Per the spec's explicit instruction, this is documented (not fixed) and the two capabilities are left with no adapter, failing closed with `ADAPTER_NOT_FOUND`. Classification: PRE-EXISTING, OUT-OF-SCOPE for Phase 4 (building a service-principal/delegation mechanism into `requireAdmin()` would itself be a significant, security-sensitive architectural change requiring its own dedicated design/review — arguably future Phase 6+ territory, not a "thin adapter translation").

## Secondary finding (documented, not blocking, not fixed — the capability is already blocked for the reason above)

`createCoupon`'s duplicate-code error is a plain thrown `Error` matched by message string, not a structured code; a true concurrent-race unique-constraint violation (Prisma `P2002`) is not caught anywhere in the existing action. This is a PRE-EXISTING gap in the main application's own code (`app/(admin)/admin/coupons/actions.ts`), unrelated to and unaffected by Phase 4 — documented per the spec's "if an existing service is flawed but unrelated: DOCUMENT IT, do not silently modify it" instruction. No change was made to this file.

## Verification of "zero bugs" claim

Full regression (312 tests across 34 files) was re-run after writing all Phase 4 tests, confirming: no flaky test, no order-dependent failure, no test-isolation leak between adapter test files (each uses `vi.resetModules()` + a fresh `createExecutionFakeDb()` instance). `npx tsc --noEmit`, `npx eslint`, and `npm run build` were each run fresh after all Phase 4 code was written, not just once mid-implementation.
