# Phase 12 — 07 SSRF

## Current exposure: none

No gateway module makes a network request (static scan in `p12-ssrf` and `p12-supply-chain`); no capability input accepts a URL, host or callback; the Phase 1 backend router registers no destination. An agent has nothing to point the platform at.

## Outbound guard for future use

`security/outbound-guard.ts` is the only permitted way for future gateway code to call out. It is built and tested now so a future capability cannot add an unguarded request.

URL check (`checkOutboundUrl`): `https:` only; no `user:password@`; port 443 unless allowlisted; no IP literals (the WHATWG parser normalises decimal / octal / hex / IPv6 forms first); no single-label, `localhost`, `.local`, `.internal`, `.lan`, `.home.arpa`, `.intranet`, `.corp` hosts; host on a static reviewed allowlist (exact or `*.domain`); empty allowlist = nothing allowed; URL length ≤ 2048.

DNS check (`createGuardedLookup`): runs inside the socket's `lookup`, so the address checked is the address connected to (defeats DNS rebinding and TOCTOU). Every answer must be public: private, loopback, link-local (including `169.254.169.254`), CGNAT, multicast, reserved, IPv4-mapped / NAT64 forms of those, unique-local and documentation ranges are refused. A mixed answer is refused; resolution errors fail closed. The `all: true` form used by Happy Eyeballs is honoured.

Transport (`safeOutboundRequest`): `https.request` with the guarded lookup and `agent: false` (no pooled socket reuse); no ambient credentials; redirects never followed (the `Location` is returned for the caller to re-check); response size cap and timeout; allowlisted response headers only. Refusals raise `OutboundBlockedError` (`code: "OUTBOUND_BLOCKED"`, a reason code) and can be evidenced with `recordOutboundBlocked`.

## Proof

`p12-ssrf.test.ts`: URL payload table (schemes, credentials, ports, IP literal encodings, local names, allowlist edge cases); address classification table; guarded lookup (public, private, mixed, metadata, rebinding, `all: true`, resolution failure); transport (fresh agent, header allowlist, no redirects, size cap, timeout, refused URL never reaches the transport); no agent-reachable outbound request.
