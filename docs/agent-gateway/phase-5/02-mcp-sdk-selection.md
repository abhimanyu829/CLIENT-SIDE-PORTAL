# Phase 5 — MCP SDK Selection (Step 0 Audit)

## Existing dependency check

No MCP dependency existed in `package.json` prior to this phase (confirmed via grep across the full manifest — zero hits for `modelcontextprotocol`/`mcp-sdk`).

## SDK chosen

`@modelcontextprotocol/sdk@1.31.0`, pinned exact (`--save-exact`), added as a direct dependency.

### Why this SDK, this version, and not the alternative

The official TypeScript SDK repository is mid-transition to a new split-package v2 (`@modelcontextprotocol/server` + `@modelcontextprotocol/client`), which was still on pre-release/alpha versions (`2.0.0-alpha.x`) at the time of this audit and requires `zod` v4 core internals. Choosing v2 would have forced an ecosystem-wide zod migration in this codebase — explicitly forbidden by the spec ("DO NOT upgrade unrelated packages merely to implement Phase 5," "DO NOT silently migrate the application stack").

`@modelcontextprotocol/sdk@1.31.0` is the current stable v1.x line, still actively maintained (the v2 README states v1.x "continues to receive bug fixes and security updates for at least 6 months after v2's release"), and its `peerDependencies` are `zod: "^3.25 || ^4.0"` — directly compatible with this app's already-installed `zod@3.25.76` (confirmed via `npm ls zod` both before and after installation: it stayed deduped at the same single instance, zero version bump anywhere in the tree).

Node engine requirement: `>=18`. This app runs Node `22.20.0` — compatible.

### Verification method

Rather than relying on documentation pages (which can lag actual package behavior), the exact candidate tarball was fetched with `npm pack @modelcontextprotocol/sdk@1.31.0`, extracted locally, and its real `.d.ts` type declarations were read directly to confirm every API shape referenced in this phase's code (`McpServer.registerTool()`, `WebStandardStreamableHTTPServerTransport`, `AuthInfo`, `RequestHandlerExtra`) before writing any implementation. The extracted tarball was deleted afterward, never committed.

## Protocol version

Read directly from the SDK's own `src/types.ts` (v1.x branch):

```
LATEST_PROTOCOL_VERSION = "2025-11-25"
SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"]
DEFAULT_NEGOTIATED_PROTOCOL_VERSION = "2025-03-26"
```

This is the exact version model used — no invented hybrid version list, no hard-coded obsolete session behavior from older examples. Protocol version negotiation itself (the `initialize` request/response handshake, and the `MCP-Protocol-Version` header validation on subsequent requests) is handled entirely internally by `WebStandardStreamableHTTPServerTransport` — this phase does not reimplement or duplicate that logic.

## Dependency audit

`npm audit` after installation shows the app's existing 35 pre-existing vulnerabilities, all in unrelated transitive dependencies (Next.js, firebase-admin, vitest, etc.) — zero mention of `@modelcontextprotocol` anywhere in the audit output. This install did not introduce any new vulnerable dependency.
