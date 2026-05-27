import * as React from "react"
import { Resend } from "resend"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

export const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

const EMAIL_FROM = env.EMAIL_FROM || "NexusAI <onboarding@resend.dev>"

interface SendEmailParams {
  to: string | string[]
  subject: string
  react: React.ReactElement
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  tags?: { name: string; value: string }[]
}

interface SendEmailResult {
  id?: string
  error?: string
}

/**
 * Sends a transactional email using Resend.
 * All emails are sent from the configured EMAIL_FROM address.
 * Errors are logged but NOT re-thrown — caller decides how to handle.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, react, replyTo, cc, bcc, tags } = params

  console.log(`[EMAIL] Sending email to ${Array.isArray(to) ? to.join(",") : to} — subject: "${subject}"`)

  try {
    if (!resend) {
      logger.warn({ subject, to }, "[Resend] Email skipped because RESEND_API_KEY is not configured")
      console.log("[EMAIL] ❌ RESEND_API_KEY not configured")
      return { error: "Email provider not configured" }
    }
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      react,
      ...(replyTo && { reply_to: replyTo }),
      ...(cc && { cc }),
      ...(bcc && { bcc }),
      ...(tags && { tags }),
    })

    if (error) {
      console.error(`[EMAIL] ❌ Send failed: ${error.message}`)
      logger.error({ error, subject, to }, "[Resend] Email send failed")
      return { error: error.message }
    }

    console.log(`[EMAIL] ✅ Sent successfully — Resend ID: ${data?.id}`)
    logger.info({ id: data?.id, subject, to }, "[Resend] Email sent")
    return { id: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[EMAIL] ❌ Exception: ${message}`)
    logger.error({ err, subject, to }, "[Resend] Email send threw exception")
    return { error: message }
  }
}

/**
 * Sends a batch of emails (max 100 per Resend batch limit).
 */
export async function sendEmailBatch(
  emails: { to: string; subject: string; react: React.ReactElement }[]
) {
  if (emails.length === 0) return []

  const batch = emails.map(({ to, subject, react }) => ({
    from: EMAIL_FROM,
    to,
    subject,
    react,
  }))

  try {
    if (!resend) {
      logger.warn({ count: emails.length }, "[Resend] Batch email skipped because RESEND_API_KEY is not configured")
      return []
    }
    const { data, error } = await resend.batch.send(batch)
    if (error) {
      logger.error({ error }, "[Resend] Batch send failed")
    }
    return data ?? []
  } catch (err) {
    logger.error({ err }, "[Resend] Batch send threw exception")
    return []
  }
}
