import { Worker, Job } from "bullmq"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { resend } from "@/lib/resend"
import React from "react"
import { WelcomeEmail } from "@/emails/WelcomeEmail"
import { SubscriptionRenewalEmail } from "@/emails/SubscriptionRenewalEmail"

const connection = {
  url: env.REDIS_URL,
}

const getEmailTemplate = (templateName: string, props: any) => {
  switch (templateName) {
    case "WelcomeEmail":
      return React.createElement(WelcomeEmail, props)
    case "SubscriptionRenewalEmail":
      return React.createElement(SubscriptionRenewalEmail, props)
    default:
      throw new Error(`Template ${templateName} not found`)
  }
}

export const emailWorker = new Worker("email", async (job: Job) => {
  logger.info({ jobId: job.id }, "Processing email job")
  
  const { to, subject, templateName, props } = job.data

  try {
    const template = getEmailTemplate(templateName, props)
    
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      react: template,
    })
    
    logger.info({ jobId: job.id, to }, "Email sent successfully")
  } catch (error: any) {
    logger.error({ err: error, jobId: job.id }, "Failed to send email")
    throw error
  }
}, { connection })

emailWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Email job failed")
})

logger.info("Email worker initialized")
