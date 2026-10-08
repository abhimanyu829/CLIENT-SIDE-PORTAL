-- Phase 1 — Subscription Domain Foundation
-- STRICTLY ADDITIVE. No tables created/dropped/renamed. No existing columns
-- altered. Existing Subscription rows keep working: both new columns are
-- nullable and default to NULL (= "legacy, created before Phase 1").

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('CHECKOUT', 'STRIPE_WEBHOOK', 'RAZORPAY_WEBHOOK', 'ADMIN', 'SYSTEM');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "source" "SubscriptionSource";
ALTER TABLE "Subscription" ADD COLUMN "environment" TEXT;
