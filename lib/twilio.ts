import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

let _twilioClient: any = null

function getTwilioBase() {
  // Accept both TWILIO_* and MSG91_* (MSG91 is the Indian SMS provider)
  const accountSid = env.TWILIO_ACCOUNT_SID || process.env.MSG91_AUTH_KEY
  const authToken = env.TWILIO_AUTH_TOKEN || process.env.MSG91_SENDER_ID
  const phoneFrom = env.TWILIO_PHONE_NUMBER || process.env.MSG91_DLT_TEMPLATE_ID

  if (!accountSid || !authToken) return null

  return { accountSid, authToken, phoneFrom }
}

export function getTwilio() {
  if (_twilioClient) return _twilioClient

  const base = getTwilioBase()
  if (!base) return null

  try {
    const twilio = require("twilio")
    _twilioClient = twilio(base.accountSid, base.authToken)
    return _twilioClient
  } catch {
    logger.warn("Twilio SDK not installed — SMS features disabled")
    return null
  }
}

const twilio = new Proxy({} as any, {
  get(_target, prop) {
    const client = getTwilio()
    if (!client) {
      return () => Promise.reject(new Error("Twilio is not configured"))
    }
    return (client as any)[prop]
  },
})

export async function sendSms(to: string, body: string): Promise<boolean> {
  const base = getTwilioBase()

  if (!base?.phoneFrom) {
    logger.warn("TWILIO_PHONE_NUMBER not configured — SMS not sent")
    return false
  }

  try {
    const client = getTwilio()
    if (!client) return false

    await client.messages.create({
      to,
      from: base.phoneFrom,
      body,
    })

    logger.info({ to, bodyLength: body.length }, "SMS sent successfully")
    return true
  } catch (error: any) {
    logger.error({ error: error.message, to }, "Failed to send SMS")
    return false
  }
}
