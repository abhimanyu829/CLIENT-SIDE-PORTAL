# Phase 5 — Bug Report

## Methodology

Same as Phase 4: implement -> unit test -> integration test (real SDK objects) -> route-handler/end-to-end test -> security/concurrency test -> regression test -> inspect every failure -> reproduce independently -> determine root cause -> classify (P0-P3, PHASE-5 INTRODUCED / SDK-BEHAVIOR-DISCOVERED / PRE-EXISTING / OUT-OF-SCOPE) before editing any code.

## Bugs found and fixed this phase

### Bug #1 — P1, PHASE-5 INTRODUCED — duplicate tool-name collision across capability versions

**Symptom**: `mcp-tool-projection.test.ts` #18 ("capability-version mapping") failed — expected the projected tool to carry version 2, got version 1.

**Root cause**: `projectTools()`'s first implementation iterated `registry.list()` (one row per registered `(id, version)` pair) and projected every row into a tool 1:1. If a capability ever has two registered versions both `AGENT_AVAILABLE`/`ACTIVE`, this produces two `ProjectedTool` entries with the SAME `name` (tool names are the bare capability id, not `id@vN`) — a real collision `server.registerTool()` would either silently overwrite or (depending on SDK version) throw on, not just a cosmetic duplicate in a list.

**Fix**: Dedupe by capability id first (insertion-order `Set`), then resolve each distinct id through `registry.get()` — Phase 3's own deterministic "current version" resolution — rather than trusting whichever row order `list()` happened to produce.

**Verification**: `mcp-tool-projection.test.ts` #18 now passes; re-ran the full `mcp-*` suite and full regression suite — no other test affected.

### Bug #2 — P1, PHASE-5 INTRODUCED — missing `enableJsonResponse: true` causing SSE responses instead of JSON

**Symptom**: `mcp-route-handler.test.ts` failed with `SyntaxError: Unexpected end of JSON input` when calling `res.json()` on the response from `handleMcpRequest()`.

**Root cause**: The production `WebStandardStreamableHTTPServerTransport` construction in `route-handler.ts` did not set `enableJsonResponse`. The SDK's default behavior for the Streamable HTTP transport is to respond via an SSE (`text/event-stream`) stream, even to a single-shot request — incompatible with this application's request/response-based audit-hook model (see `08-async-operations.md` for the full architectural reasoning).

**Fix**: Added `enableJsonResponse: true` to the transport options in `route-handler.ts`, with an explanatory comment. Every test-file transport construction was updated to match (so tests exercise the same configuration production uses).

**Verification**: `mcp-route-handler.test.ts` now passes in full; re-ran the full suite.

### Bug #3 — P2, TYPECHECK-ONLY, PHASE-5 INTRODUCED (test code) — `AllowAllForTestingAuthorizer` argument-count mismatch

**Symptom**: `npx tsc --noEmit` reported `error TS2554: Expected 0 arguments, but got 4` at a call site in `mcp-authorization-hook.test.ts`.

**Root cause**: `AllowAllForTestingAuthorizer.authorize()` was initially written with a zero-argument signature, while the `CapabilityAuthorizer` interface it implements requires four (`context`, `capability`, `input`, `resourceContext`). TypeScript's structural typing didn't catch the mismatch at the class-declaration site in a way that surfaced immediately during development — it surfaced instead as a call-site arity error once a test tried to call it with the full argument list the interface demands.

**Fix**: Added the full four-parameter signature (all four intentionally unused, prefixed `_`) to match `CapabilityAuthorizer` exactly.

**Verification**: `npx tsc --noEmit` clean except the one pre-existing, out-of-scope `app/api/feedback/route.ts:128` error (unchanged since Phase 1).

## Non-bugs discovered during the Step 0 audit (informational, documented, not fixed)

- **SDK's own host/origin/DNS-rebinding options are `@deprecated`**: not a bug, a discovered fact that shaped the design (`transport-security.ts` was built instead of using them) — see `09-security-boundary.md`.
- **Stateless transports cannot be reused across `handleRequest()` calls**: not a bug, an SDK runtime constraint discovered via a thrown error while first prototyping a shared-transport approach; it directly shaped the "fresh server+transport per HTTP request" architecture documented in `06-execution-flow.md`. No workaround was needed — per-request instantiation is the SDK's own intended usage pattern for stateless deployments, confirmed against the SDK's own source and examples.

## Verification of "zero unresolved Phase-5-introduced issues" claim

After both functional bugs (#1, #2) and the typecheck issue (#3) were fixed, the full suite was re-run from a clean state: `npx vitest run` (373/373), `npx tsc --noEmit` (clean except the one pre-existing feedback/route.ts error, present since Phase 1 and unrelated to this phase), `npx eslint . --ext .ts,.tsx --format compact` (122 problems, identical to the Phase 1-4 baseline, zero new, zero hits under `lib/agent-gateway/mcp/`), and `npm run build` (succeeded, `/api/agent-gateway/mcp` present in the route output). No flaky or order-dependent test was observed across repeated runs.
