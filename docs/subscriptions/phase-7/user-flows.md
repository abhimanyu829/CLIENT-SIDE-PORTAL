# User Flows — Phase 7

## Paid subscription

1. Plans page → Subscribe on a published paid plan.
2. `POST /checkout` → Phase-4 creates the recurring subscription server-side
   (dedupes repeats); returns public key id + internal/provider subscription ids.
3. Razorpay subscription checkout opens (recurring consent, explicit).
4. Callback → `POST /confirm-checkout` → subscription-specific signature
   verified. UI shows "activation pending" — the verified webhook (Phase 4)
   drives ACTIVE; the overview reflects it on refresh.

Checkout opening alone never shows active. Payment-cancelled → error state with
the failed reason; billing stays trial/previous state.

## Free Forever

Plans page → Choose Free Forever → `POST /enroll-free` → Phase-6 grants,
permanent; success banner + overview chip. Duplicate requests return the
existing enrollment.

## 14-day trial

Plans page → Start trial → eligibility fetched server-side
(`GET /trial?planId=`) → eligible: "Activate trial" → `POST /trial` → active
with exact 14-day expiry shown (server timestamp, local timezone rendering).
Pending provisioning shows honest processing; failure keeps PENDING with error.
Ineligible/consumed/expired states render without implying access.

## Cancellation / pause / resume

Overview cards → Cancel at period end (renewal stops; access through paid
period) or Cancel immediately (revokes subscription access now; standalone/free
untouched) via confirmation dialog → `POST /action` → state refreshes from the
backend. Pause (ACTIVE only), Resume (PAUSED only).

## Billing history

Overview Billing section lists subscription charges/invoices/payments
(customer-scoped). Existing `/dashboard/invoices` covers standalone purchase
invoices.