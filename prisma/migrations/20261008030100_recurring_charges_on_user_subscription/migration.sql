-- Phase 4 follow-up — recurring charges attach to UserSubscription (Stack B)
-- STRICTLY ADDITIVE + one FK re-point within the newly-created Phase-4 model.
-- The SubscriptionCharge table was created two minutes earlier in
-- 20261008030000 with a mistaken FK to the Stack-A Subscription model; the
-- correct billing record for plan-based recurring subscriptions is
-- UserSubscription (Stack B). Dropping that brand-new FK and re-pointing it is
-- safe — no production or standalone data is affected. No existing commerce,
-- plan-catalog or entitlement table is touched.

-- DropForeignKey
ALTER TABLE "SubscriptionCharge" DROP CONSTRAINT "SubscriptionCharge_subscriptionId_fkey";

-- AlterTable (additive columns on UserSubscription)
ALTER TABLE "UserSubscription"
    ADD COLUMN "planVersionId" TEXT,
    ADD COLUMN "environment" TEXT;

-- CreateIndex
CREATE INDEX "UserSubscription_planVersionId_idx" ON "UserSubscription"("planVersionId");

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "UserSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;