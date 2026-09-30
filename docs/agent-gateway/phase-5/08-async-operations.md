# Phase 5 — Async Operations & Streaming (not built, and why)

## No ASYNC capability exists yet

Phase 4's manifest (`docs/agent-gateway/phase-4/08-async-execution.md`) confirms: none of the currently registered/adapted capabilities (`products.list`, `products.get`, `subscriptions.get`, `tickets.list`) are `ASYNC` — every one is a fast, synchronous Prisma read with no queue, no job, no polling need. Phase 5 inherits this fact rather than inventing async support ahead of any real use case.

## `enableJsonResponse: true` — plain request/response, not SSE

Every `WebStandardStreamableHTTPServerTransport` instance in this phase (production, in `route-handler.ts`, and every test) is constructed with `enableJsonResponse: true`. Without it, the SDK's default behavior for the Streamable HTTP transport is to respond with an SSE (`text/event-stream`) stream even to a single-shot `tools/call` — discovered as a real bug during this phase's own test-writing (see `12-bug-report.md`, Bug #2): the production code was initially missing this option, and `mcp-route-handler.test.ts` caught it via `SyntaxError: Unexpected end of JSON input` when the test tried to `res.json()` an SSE stream.

Choosing plain JSON responses over SSE is not a workaround — it is the architecturally correct choice given the current state of the system: this application's existing audit-hook model (`getAuditHook().record(...)` in `route-handler.ts`) records against one known final `response.status` once `handleRequest()` resolves. A long-lived SSE stream has no single "final status" in that sense; wiring the audit hook to a streaming response would require a materially different design (buffering, partial-completion semantics, stream-abort handling) that has no justification while every adapter is synchronous and sub-second.

## No MCP `notifications/*` support

The SDK supports server-to-client notifications (e.g. `notifications/tools/list_changed`) over a long-lived connection. Phase 5 builds none of this — the transport is stateless and per-request, so there is no persistent connection to notify over, and no capability's registration state changes mid-request in a way that would need to be pushed to a connected client anyway. If a future phase needs live tool-list updates (e.g. a capability newly enabled while a client is "connected"), that would require moving off the stateless model first — a decision explicitly deferred, not attempted here.

## No long-running-operation pattern (polling tokens, job ids, `operations/*`)

Not built, per the spec's explicit "Phase 5 must not implement" list and because there is nothing to poll — see above. If a future ASYNC capability is registered in Phase 4, Phase 5's tool-call callback would need a corresponding addition (e.g. returning a job-id-shaped result immediately and exposing a separate `*.status` tool, or a resource, to poll it) — sketched here only as a note for that future work, not implemented now.

## Resources and prompts: also not built

Per the spec, MCP resources and prompts should only be built if Phase 0-4's audit explicitly identified a safe, well-scoped use case. It did not — Phase 3's capability manifest models are already the correct “tool” shape (discrete, permissioned, individually exposable actions), and no existing Phase 1-4 concept maps naturally onto a browsable "resource" (e.g. an arbitrary file/URI-addressable content store) or a reusable "prompt template." `mcp/server.ts` advertises only `{ capabilities: { tools: {} } }` in its `ServerCapabilities` — no `resources`, no `prompts` — so an external client's `initialize` response correctly reflects that neither is supported, rather than advertising a capability this phase doesn't actually implement.
