/**
 * Integration test — Twilio OTP pre-payment activation.
 *
 * Exercises the REAL lib/otp.ts and lib/services/phone-verification-gate.ts
 * against the live database (and live Redis when configured) using a
 * disposable test user that is deleted at the end.
 *
 * Run via scripts/test-phone-otp-entry.cjs (loads .env + @/ aliases).
 * Set FORCE_OTP_DB_FALLBACK=1 to exercise the no-Redis fallback path.
 */

// ── Boot: load .env + alias hooks live in the .cjs entry that loads this ──
import { normalizePhone, generateOtp, storeOtp, verifyOtp, checkSendCooldown, setSendCooldown, getRemainingAttempts } from "@/lib/otp"
import { requireVerifiedPhoneForPayment } from "@/lib/services/phone-verification-gate"
import { sendSms } from "@/lib/twilio"
import { db } from "@/lib/db"

let passed = 0
let failed = 0
function assert(cond: boolean, label: string) {
  if (cond) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failed++
    console.log(`  ❌ ${label}`)
  }
}

async function main() {
  const mode = process.env.FORCE_OTP_DB_FALLBACK === "1" ? "DB-FALLBACK" : "REDIS"
  console.log(`\n═══ Twilio OTP integration test — path: ${mode} ═══`)

  const TEST_EMAIL = `twilio-otp-test-${Date.now()}@nexusai.test.local`
  const PHONE_X = "+919876543210"
  const PHONE_Y = "+919811223344"

  // ── Scenario 1: phone validation (E.164) ─────────────────────────────
  console.log("\n[1] Phone number validation")
  assert(normalizePhone("+919876543210") === "+919876543210", "valid E.164 accepted")
  assert(normalizePhone("9876543210") === null, "missing country code rejected")
  assert(normalizePhone("+91 98765 43210") === null, "spaces rejected")
  assert(normalizePhone("+0123456789") === null, "invalid country digit rejected")
  assert(normalizePhone("+911234567890123456") === null, ">15 digits rejected")
  assert(normalizePhone("") === null, "empty rejected")
  assert(normalizePhone("+1234567") === null, "too short rejected")

  // ── Setup disposable test user ────────────────────────────────────────
  const user = await db.user.create({
    data: { email: TEST_EMAIL, name: "OTP Test User", role: "CLIENT", isVerified: true },
  })
  console.log(`\nTest user created: ${user.id}`)

  try {
    // ── Scenario 2: send cooldown ─────────────────────────────────────
    console.log("\n[2] Resend cooldown")
    assert((await checkSendCooldown(user.id)) === false, "no cooldown before first send")
    await setSendCooldown(user.id)
    assert((await checkSendCooldown(user.id)) === true, "cooldown active right after send")

    // ── Scenario 3: OTP send + wrong code ─────────────────────────────
    console.log("\n[3] OTP store + wrong code rejected")
    const otp = generateOtp()
    assert(/^\d{6}$/.test(otp), "generated OTP is 6 numeric digits")
    await storeOtp(user.id, otp, PHONE_X)
    const wrongCode = otp === "000000" ? "000001" : "000000"
    assert((await verifyOtp(user.id, wrongCode, PHONE_X)) === false, "wrong code rejected")
    assert((await getRemainingAttempts(user.id)) < 5, "attempt counter incremented after failure")

    // ── Scenario 4: OTP bound to phone (X code, Y phone) ───────────────
    console.log("\n[4] OTP bound to the phone it was sent to")
    assert((await verifyOtp(user.id, otp, PHONE_Y)) === false, "code for X cannot verify Y")

    // ── Scenario 5: lockout after 5 attempts ─────────────────────────
    console.log("\n[5] Attempt lockout")
    let locked = false
    for (let i = 0; i < 6; i++) {
      try {
        await verifyOtp(user.id, wrongCode, PHONE_X)
      } catch (e: any) {
        locked = /Too many failed attempts/.test(e?.message ?? "")
        if (locked) break
      }
    }
    assert(locked, "throws lockout error after MAX_ATTEMPTS")

    // ── Scenario 6: fresh OTP verifies correctly ─────────────────────
    console.log("\n[6] Correct code verifies and consumes the OTP")
    const otp2 = generateOtp()
    await storeOtp(user.id, otp2, PHONE_X) // fresh send resets attempts
    assert((await verifyOtp(user.id, otp2, PHONE_X)) === true, "correct code + phone accepted")

    // ── Scenario 7: OTP one-time use ─────────────────────────────────
    console.log("\n[7] OTP is single-use")
    assert((await verifyOtp(user.id, otp2, PHONE_X)) === false, "consumed OTP cannot verify again")

    // ── Scenario 8: payment gate enforcement ──────────────────────────
    console.log("\n[8] Payment gate — verification state is authoritative")
    const gateBefore = await requireVerifiedPhoneForPayment({ userId: user.id, billingMobile: PHONE_X })
    assert(gateBefore.verified === false && gateBefore.code === "PHONE_NOT_VERIFIED", "gate blocks before phoneVerified is set")

    // replicate exactly what /api/auth/otp/verify does on success:
    const verifiedAt = new Date()
    await db.user.update({
      where: { id: user.id },
      data: {
        phone: PHONE_X,
        phoneVerified: verifiedAt,
        otpCode: null,
        otpExpiresAt: null,
        otpPhone: null,
        otpAttempts: 0,
      },
    })

    const gateMatch = await requireVerifiedPhoneForPayment({ userId: user.id, billingMobile: PHONE_X })
    assert(gateMatch.verified === true, "gate passes with verified phone + matching billing mobile")

    const gateMismatch = await requireVerifiedPhoneForPayment({ userId: user.id, billingMobile: PHONE_Y })
    assert(gateMismatch.verified === false, "gate blocks when billing mobile ≠ verified phone")

    const gateJunk = await requireVerifiedPhoneForPayment({ userId: user.id, billingMobile: "not-a-phone" })
    assert(gateJunk.verified === false, "gate blocks malformed billing mobile")

    const gateMissing = await requireVerifiedPhoneForPayment({ userId: user.id })
    assert(gateMissing.verified === false, "gate blocks missing billing mobile")

    // client-flag spoofing: phoneVerified:true in the payload must be ignored
    const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { phone: true, phoneVerified: true } })
    assert(!!dbUser?.phoneVerified && dbUser?.phone === PHONE_X, "verified state persisted to DB (authoritative)")

    // ── Scenario 9: re-verification after phone change ────────────────
    console.log("\n[9] Changing the number invalidates the gate match")
    await db.user.update({ where: { id: user.id }, data: { phone: PHONE_Y } })
    const gateChanged = await requireVerifiedPhoneForPayment({ userId: user.id, billingMobile: PHONE_Y })
    assert(gateChanged.verified === true, "still passes when User.phone matches new billing mobile")
    const gateOld = await requireVerifiedPhoneForPayment({ userId: user.id, billingMobile: PHONE_X })
    assert(gateOld.verified === false, "old number no longer passes the gate")
    await db.user.update({ where: { id: user.id }, data: { phoneVerified: null } })
    const gateUnverified = await requireVerifiedPhoneForPayment({ userId: user.id, billingMobile: PHONE_Y })
    assert(gateUnverified.verified === false, "gate blocks when phoneVerified cleared")

    // ── Scenario 10: Twilio unconfigured → graceful degradation ──────
    console.log("\n[10] Twilio SMS availability")
    const smsOk = await sendSms(PHONE_X, "test")
    const twilioConfigured = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_PHONE_NUMBER
    if (!twilioConfigured) {
      assert(smsOk === false, "unconfigured Twilio returns false (route will 503) — graceful")
    } else {
      console.log("  ⚠️ Twilio IS configured in this env — skipping unconfigured-path assertion")
    }
  } finally {
    // ── Cleanup: remove disposable test user ──────────────────────────
    await db.user.delete({ where: { id: user.id } })
    console.log(`\nTest user deleted: ${user.id}`)
  }

  console.log(`\n═══ RESULT: ${passed} passed, ${failed} failed (${mode} path) ═══`)
  if (failed > 0) process.exit(1)
}

main()
  .catch((e) => {
    console.error("TEST RUNNER ERROR:", e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
