import { emailQueue } from "@/lib/queue"

export type EmailJobPayload = {
  to: string | string[]
  subject: string
  templateName: "WelcomeEmail" | "SubscriptionRenewalEmail"
  props: Record<string, any>
}

export const sendEmailJob = async (payload: EmailJobPayload) => {
  await emailQueue.add("send-email", payload)
}
