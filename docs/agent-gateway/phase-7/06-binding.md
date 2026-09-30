# Phase 7 — Operation Binding

An approval authorizes exactly one operation. The binding digest (`approvals/binding.ts`) is:

```
sha256("abhibhi.approval-binding.v1\n" + canonicalJson({
  connectionId, agentId, ownerId, teamId,
  capabilityId, capabilityVersion,
  resourceType, resourceId, environment,
  inputDigest,                  // sha256("abhibhi.approval-input.v1\n" + canonicalJson(input))
  authorizationPolicyRef,       // "<Phase 6 policyVersionId>@v<n>" or "none"
  autonomyPolicyVersion         // number, or null for the default posture
}))
```

Changing any field changes the digest, so the gate's lookup misses and the approval is unusable. Tested field by field in `p7-approval-primitives.test.ts`.

## Canonical JSON

No canonicalizer existed in the repo; `approvals/canonical-json.ts` follows RFC 8785 rules:

- keys sorted recursively; array order kept
- `undefined` keys omitted (absent), `null` kept — absent and null differ
- `Date` -> ISO UTC string
- NaN, Infinity, bigint, functions, symbols, invalid dates rejected (`CanonicalizationError` -> gate fails closed)
- no Unicode normalization (visually identical but different strings bind differently — the safe direction)
- maximum depth 32

## Human confirmation of the binding

The approval page shows the full binding digest. The decision endpoint requires `confirmedBindingDigest` and compares it in constant time with the stored value, so a human approves the specific operation they reviewed, not whatever the row later contains.
