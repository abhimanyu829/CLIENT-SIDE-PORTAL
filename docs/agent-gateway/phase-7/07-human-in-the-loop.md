# Phase 7 — Human-in-the-Loop

## Who can decide

SUPER_ADMIN only (`APPROVER_SCOPE_SUPER_ADMIN`). The identity comes from the existing stack: Clerk session -> `requireSuperAdmin()` (role re-read from the DB, banned users refused) -> Clerk `sessionId`. No second identity or RBAC system.

## What the human must do to APPROVE

1. Open `/admin/agent-approvals/<ref>`. Loading the page changes nothing.
2. Review the redacted summary (capability, risk, reversibility, side effects, environment, resource, inputs, consequence) and the binding digest.
3. Tick the confirmation box.
4. Click "Send approval code to my phone" — a 6-digit code (existing `lib/otp.ts` generator) is sent by SMS (existing `lib/twilio.ts`) to the approver's verified `User.phone`.
5. Enter the code and click Approve. The request carries `confirmedBindingDigest` and `stepUpCode`.

Rejecting requires steps 1–3 only. Cancelling a live request requires the session only.

## Why the SMS step-up exists

An agent driving the desktop through Cua can operate a browser where an admin is already signed in. To the backend, that click is indistinguishable from a human's. Session + click is therefore not proof of a human decision, and an on-screen challenge would not help either (Cua can read and type it). The step-up code travels on a channel outside the desktop Cua controls.

## Step-up code properties

- stored only as `sha256("abhibhi.approval-step-up.v1\n" + requestId + approverId + code)`
- bound to one request and one approver
- valid 5 minutes (never beyond the request's own expiry)
- 5 wrong attempts lock the code; a new code must be requested
- re-issuing replaces the previous code; approval only succeeds against the exact hash just verified
- never returned by any API, never logged
- stored on the approval row, separate from the login OTP Redis keys (no collision)

## Fail-closed prerequisites

Approval is impossible (`STEP_UP_DELIVERY_FAILED`) if the approver has no verified phone or SMS delivery fails. Twilio (or the MSG91 fallback) must be configured in each environment where approvals are used.

## Decision record

Exactly one `AgentApprovalDecision` per request, written in the same transaction as the state change: approver user id, role, hashed session reference, method (`HUMAN_SESSION_PLUS_SMS_STEP_UP` or `HUMAN_SESSION` for rejection), scope digest, reason code.
