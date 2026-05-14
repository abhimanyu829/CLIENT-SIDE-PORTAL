# Runbook: Handling a Failed Payment

## Trigger
Stripe webhook `invoice.payment_failed` or Razorpay `payment.failed` received.

## Steps
1. Verify webhook signature is valid (already handled in route handler)
2. Find the subscription by `stripeSubId` or `razorpaySubId`
3. Update `Subscription.status` to `PAST_DUE`
4. Queue dunning email: `emailQueue.add("payment-failed", { userId, invoiceId })`
5. Create a `Notification` record for the user (in-app notification)
6. Trigger Pusher event to `private-user-{userId}` with type `PAYMENT`
7. Do NOT cancel the subscription immediately — allow retry period (Stripe handles retries)

## Expected Outcome
User receives email + in-app notification about failed payment.
Subscription moves to PAST_DUE (features may be restricted based on business rules).
Stripe will automatically retry the payment per the retry schedule in Stripe dashboard.

## If Steps Fail
- Webhook handler 500s → Check Railway logs, verify `STRIPE_WEBHOOK_SECRET` env var
- Email not sending → Check BullMQ worker is running (`npm run worker`), check Resend dashboard
- User not notified → Check Pusher dashboard for event delivery

## Escalation
If payment remains failed after 3 retries (Stripe default), subscription auto-cancels.
Alert goes to admin dashboard. CRM team follows up manually.
