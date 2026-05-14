# Workflow: Ship to Production

## Pre-Ship Checklist

### Code Quality
```bash
npm run typecheck    # must be 0 errors
npm run lint         # must be 0 errors
npm test             # must be all passing
```

### Environment
```
Verify in Railway dashboard:
- All env vars from .env.example are set
- DATABASE_URL points to production DB
- NEXTAUTH_URL = https://yourproductiondomain.com
- NODE_ENV = production
- Stripe keys are LIVE keys (not test)
- Razorpay keys are LIVE keys
```

### Database
```bash
# Run migration (never db push in prod)
npx prisma migrate deploy
# Verify schema matches expectation
npx prisma studio  # quick sanity check
```

### Webhooks
```
Update in Stripe dashboard:
  Webhook URL: https://yourdomain.com/api/payments/stripe/webhook
  Events: checkout.session.completed, invoice.payment_succeeded, 
          invoice.payment_failed, customer.subscription.updated,
          customer.subscription.deleted, charge.refunded

Update in Razorpay dashboard:
  Webhook URL: https://yourdomain.com/api/payments/razorpay/webhook
  Events: payment.captured, payment.failed
```

### Deploy
```bash
railway up           # triggers Railway build + deploy
railway logs         # watch for startup errors
```

### Post-Deploy Smoke Test
```
1. Visit homepage — loads correctly
2. Register a new account
3. Login with the new account
4. Visit /dashboard — loads correctly
5. Visit /admin (with admin account) — loads correctly
6. Check /api/health — returns { status: "ok" }
7. Send a test Stripe webhook (CLI: stripe trigger checkout.session.completed)
```

### Rollback Plan
```
If something is broken after deploy:
1. railway rollback  (reverts to previous deploy)
2. Fix the issue in a branch
3. Follow this checklist again before re-deploying
```
