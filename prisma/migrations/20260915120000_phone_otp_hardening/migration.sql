-- Twilio OTP pre-payment verification hardening.
-- Closes the no-Redis security gaps in the existing Twilio OTP system:
--  * otpPhone      — binds each OTP to the phone number it was sent to, so
--                     verify persists only the number that was actually proven.
--  * otpAttempts   — server-side attempt counter for the DB-fallback path
--                     (previously unlimited OTP guessing without Redis).
--  * otpLastSentAt — working resend cooldown for the DB-fallback path
--                     (previously the cooldown never triggered on fallback).
ALTER TABLE "User" ADD COLUMN "otpPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "otpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "otpLastSentAt" TIMESTAMP(3);

-- Any pre-existing verified state stays intact; verification of existing
-- users is not invalidated (non-destructive lifecycle).
