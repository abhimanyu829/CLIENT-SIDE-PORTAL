# Phase 0 — Risk Matrix

Risk is classified by actual business consequence (customer/financial/legal/production impact, reversibility, blast radius), not by HTTP method. Rationale is given for every HIGH_RISK_MUTATION and CRITICAL entry, per audit requirement.

## READ — no state mutation, default AI-autonomous candidate once auth-scoped
Products list/get, subscription read, analytics dashboards, AI monitoring stats, ticket list/get, user list/get (admin), coupon/campaign read, deployment-center list.
**Rationale:** no data is changed; risk is limited to information disclosure, governed separately in DATA-SENSITIVITY-MATRIX.md (e.g., admin analytics exposes revenue/PII — READ risk tier does not mean "no sensitivity").

## LOW_RISK_WRITE — reversible, low external impact
Create product draft, update draft description/metadata, create coupon, update coupon, bulk-generate coupons, duplicate product, create campaign (draft), create ticket, create lead, submit manual payment proof.
**Rationale:** these either create net-new non-customer-facing records (drafts) or are trivially reversible (delete the draft, close the ticket). None move money, change production-visible state, or affect another user's access.

## HIGH_RISK_MUTATION — customer/financial/production impact, reversible with effort
| Operation | Why HIGH not LOW | Why not CRITICAL |
|---|---|---|
| Publish product / change status | Customer-visible marketplace change; affects discoverability and purchasability | Fully reversible (unpublish), no money movement, no privilege change |
| Change price (tier) | Direct financial impact on future purchases; `PricingHistory` provides an audit trail but no auto-revert | Does not touch already-completed transactions; admin can always re-set the price |
| Stock adjust/decrement | Affects purchasability and (if `autoDisableOnZero`) product visibility; the decrement path has a real double-decrement bug (no idempotency key) making replay dangerous | Not a permanent/irrecoverable state — stock counts can be corrected |
| Delete tier | Orphan risk for referencing orders/subscriptions (no guard found) — could break active billing rendering, not billing charges | Doesn't touch money already collected |
| Delete coupon (hard) | Irreversible; if a coupon is referenced by campaign analytics/history the trail is lost | Scoped to marketing config, no direct financial/production system impact |
| Subscription upgrade/downgrade/pause/resume/cancel | Directly changes what the customer is billed for and what they can access; touches Stripe (external system) | Reversible via the symmetric action (reactivate, change plan back); does not touch already-settled payments |
| Refund request (buyer-initiated) | Suspends the customer's access immediately (before any refund is approved) | The *request* itself doesn't move money — approval (CRITICAL, below) does |
| Launch/pause campaign | Customer-facing; drives public "activity feed" messaging | Symmetric, instantly reversible |
| Advance/complete deployment status, apply upgrade, suspend/resume service | Directly controls whether a paying customer's service is live | State is recoverable by an admin re-running the lifecycle action; no money movement |
| Ban/unban user | Immediately blocks a real customer from the platform, invalidates all sessions | Symmetric (unban), no data loss, no financial/privilege change beyond access |

## CRITICAL — trust-boundary, financial-settlement, or privilege operations. Never generic agent tools; never autopilot.
| Operation | Why CRITICAL |
|---|---|
| Refund processing (`processRefund`) — actual gateway refund call | Moves real money at an external payment processor; **no gateway-side idempotency key exists**, so a naive retry could double-refund. This alone disqualifies it from ever being an unsupervised/autonomous agent action. |
| Manual payment verification approve | Marks a payment as legitimately received based on human judgment (comparing UTR/amount evidence) — a wrong approval either denies a paying customer or credits a non-payment. This is inherently a human-judgment task, not a rules-based one. |
| Admin "mark order paid" escape hatch | Directly overrides the financial system of record without a corresponding real payment — by design a manual override, must always remain human-gated. |
| Update service config (credentials) | Handles plaintext customer credentials before AES-256-GCM encryption; the plaintext transits the request. HIGHLY_SENSITIVE data class (see DATA-SENSITIVITY-MATRIX.md). |
| Change user role / GDPR delete / impersonate | Privilege escalation and irreversible-by-design data destruction. The architecture doc's "hard exclusions" (privilege escalation) apply directly. |
| Create/modify subadmin account or permissions | Provisions a second admin identity with its own credential/session system — a compromised or over-eager AI agent doing this autonomously is a direct path to full platform takeover. |
| Payment-provider configuration, secret rotation, DB destructive operations, arbitrary SQL/shell | Not found as implemented capabilities in this codebase (confirmed in DANGEROUS-PRIMITIVE-AUDIT.md) — flagged here only to confirm they must **never** be added as generic tools if any such admin surface is built later. |

## Cross-cutting risk note: idempotency and risk tier are independent

Several HIGH_RISK_MUTATION operations lack idempotency guards (stock decrement, lifecycle suspend/resume, subscription upgrade calling Stripe before DB write). This does not change their risk *tier*, but it does mean the Agent Gateway's `idempotencyKey` + `requestHash` mechanism (per the architecture spec) is not optional plumbing for these — it is the only thing that will prevent a retried/duplicated agent request from causing real duplicate side effects, since the underlying business logic does not protect itself.
