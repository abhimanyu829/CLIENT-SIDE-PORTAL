import { sendEmail } from "@/lib/resend"
import VerificationEmail from "@/emails/VerificationEmail"
import { emailLogger } from "@/lib/logger"

interface SendVerificationEmailParams {
  to: string
  name: string
  verificationUrl: string
  expiryMinutes?: number
}

export async function sendVerificationEmail(params: SendVerificationEmailParams) {
  const { to, name, verificationUrl, expiryMinutes = 60 } = params

  console.log(`[VERIFICATION-EMAIL] Preparing verification email for ${to}`)
  emailLogger.info({ to, name }, "Preparing verification email")

  if (!to || !to.includes("@")) {
    console.error(`[VERIFICATION-EMAIL] ❌ Invalid recipient email: ${to}`)
    emailLogger.error({ to }, "Invalid recipient email")
    return { error: "Invalid recipient email address" }
  }

  if (!verificationUrl || !verificationUrl.startsWith("http")) {
    console.error(`[VERIFICATION-EMAIL] ❌ Invalid verification URL: ${verificationUrl}`)
    emailLogger.error({ verificationUrl }, "Invalid verification URL")
    return { error: "Invalid verification URL" }
  }

  try {
    console.log(`[VERIFICATION-EMAIL] Sending verification email to ${to}...`)

    const result = await sendEmail({
      to,
      subject: "Verify your NexusAI account",
      react: VerificationEmail({
        name,
        verificationUrl,
        expiryMinutes,
        supportEmail: "support@nexusai.com",
      }),
      tags: [{ name: "type", value: "verification" }],
    })

    if (result.error) {
      console.error(`[VERIFICATION-EMAIL] ❌ Failed to send: ${result.error}`)
      emailLogger.error({ error: result.error, to }, "Failed to send verification email")
      return { error: result.error }
    }

    console.log(`[VERIFICATION-EMAIL] ✅ Sent successfully to ${to} (Resend ID: ${result.id})`)
    emailLogger.info({ id: result.id, to }, "Verification email sent successfully")
    return { id: result.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[VERIFICATION-EMAIL] ❌ Exception: ${message}`)
    emailLogger.error({ error: message, to }, "Verification email threw exception")
    return { error: message }
  }
}
