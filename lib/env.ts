import { z } from 'zod'

// Coerce empty strings ("") from .env to undefined so optional() works correctly
const optStr = z.string().min(1).optional().or(z.literal('').transform(() => undefined))
const optUrl = z.string().url().optional().or(z.literal('').transform(() => undefined))

const envSchema = z.object({
  // Core — required
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: optUrl.default('http://localhost:3000'),

  // Auth
  NEXTAUTH_URL: optUrl,
  NEXTAUTH_SECRET: optStr,
  GOOGLE_CLIENT_ID: optStr,
  GOOGLE_CLIENT_SECRET: optStr,
  GITHUB_CLIENT_ID: optStr,
  GITHUB_CLIENT_SECRET: optStr,

  // Redis / Upstash
  REDIS_URL: optStr,
  UPSTASH_REDIS_REST_URL: optUrl,
  UPSTASH_REDIS_REST_TOKEN: optStr,

  // Payments
  STRIPE_SECRET_KEY: optStr,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optStr,
  STRIPE_WEBHOOK_SECRET: optStr,
  RAZORPAY_KEY_ID: optStr,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: optStr,
  RAZORPAY_KEY_SECRET: optStr,
  RAZORPAY_WEBHOOK_SECRET: optStr,

  // Storage (Cloudflare R2)
  R2_ACCOUNT_ID: optStr,
  R2_ACCESS_KEY_ID: optStr,
  R2_SECRET_ACCESS_KEY: optStr,
  R2_BUCKET_NAME: optStr,
  NEXT_PUBLIC_R2_PUBLIC_URL: optUrl,

  // Email
  RESEND_API_KEY: optStr,
  EMAIL_FROM: optStr,

  // AI
  OPENAI_API_KEY: optStr,

  // Realtime (Pusher)
  PUSHER_APP_ID: optStr,
  PUSHER_KEY: optStr,
  PUSHER_SECRET: optStr,
  PUSHER_CLUSTER: optStr,
  NEXT_PUBLIC_PUSHER_KEY: optStr,
  NEXT_PUBLIC_PUSHER_CLUSTER: optStr,

  // Twilio / WhatsApp / MSG91
  TWILIO_ACCOUNT_SID: optStr,
  TWILIO_AUTH_TOKEN: optStr,
  TWILIO_WHATSAPP_FROM: optStr,
  TWILIO_PHONE_NUMBER: optStr,
  MSG91_AUTH_KEY: optStr,
  MSG91_SENDER_ID: optStr,
  MSG91_DLT_TEMPLATE_ID: optStr,

  // Verification
  VERIFICATION_TOKEN_EXPIRY_MINUTES: z.coerce.number().optional().default(60),
  OTP_EXPIRY_MINUTES: z.coerce.number().optional().default(10),

  // Encryption (64 hex chars = 32 bytes)
  ENCRYPTION_KEY: z.string().length(64).optional().or(z.literal('').transform(() => undefined)),
})

let parsedEnv: z.infer<typeof envSchema>

try {
  parsedEnv = envSchema.parse(process.env)
} catch (error) {
  if (error instanceof z.ZodError) {
    const missing = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')
    throw new Error(`❌ Environment variable validation failed:\n  ${missing}`)
  }
  throw error
}

export const env = parsedEnv!
