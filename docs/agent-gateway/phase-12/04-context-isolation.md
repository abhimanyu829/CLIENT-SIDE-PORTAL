# Phase 12 — 04 Context isolation

Two kinds of isolation: between tenants (one connection never sees another owner's data, tasks or approvals) and between channels (instructions and data never mix).

## Tenant isolation

- Identity comes only from the verified request context (`build-execution-context.ts`); capability schemas are strict, so `ownerId`, `userId` and similar fields in arguments are refused before anything runs.
- Adapters scope every read by the context owner and use explicit selects.
- Tasks and approvals are bound to the submitting connection; status, cancel and approval reuse from another connection return "not found" (no existence oracle).
- Correlation context is an `AsyncLocalStorage` scope per request, so concurrent requests never share a trace or request id.

Proof (`p12-isolation.test.ts`): 40 interleaved concurrent calls from two connections each return only their owner's data; identity cannot come from arguments; concurrent evidence carries the right trace id per request; another connection cannot read, cancel or reuse a task, its result or its approval.

## Channel isolation (instructions vs data)

| Channel | Origin | Trust |
|---|---|---|
| tool names, titles, descriptions, input / output schemas, annotations | reviewed core manifest only | trusted, static |
| server instructions | static gateway text | trusted, static |
| tool results (`content[0]`, `structuredContent`) | business data, may contain third-party text | data, labelled |
| content notice (`content[1]`) and `_meta` trust annotation | gateway | trusted, describes the data |

Nothing in a tool result can alter tool metadata, the tool list, a schema, a permission or a policy. The proof checks that tool metadata is identical before and after results containing tool-shaped and instruction-shaped text, and that the result is labelled `THIRD_PARTY_CONTENT`.

## Single chokepoint

The content guard runs inside `AdapterResolver.execute` after the output schema and on idempotency replays, so the synchronous MCP path, the asynchronous task path, trigger firings and recoveries all receive guarded data. Stored task results (including pre-Phase-12 rows) are guarded again on read (`TaskEngine.getStatusWithContent`).
