import { Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface ServiceLeadUserEmailProps {
  name: string
  servicePageTitle: string | null
}

export default function ServiceLeadUserEmail({
  name,
  servicePageTitle,
}: ServiceLeadUserEmailProps) {
  const serviceName = servicePageTitle ? `regarding ${servicePageTitle}` : ""
  
  return (
    <EmailShell preview="We've received your service inquiry">
      <Text style={baseStyles.greeting}>Hi {name},</Text>
      <Text style={baseStyles.paragraph}>
        Thank you for reaching out to NexusAI {serviceName}. We have received your project requirements and our team is currently reviewing them.
      </Text>
      <Text style={baseStyles.paragraph}>
        One of our specialists will get back to you shortly to discuss the next steps and how we can help you achieve your goals.
      </Text>
      <Text style={baseStyles.muted}>
        If you have any immediate questions, feel free to reply directly to this email.
      </Text>
    </EmailShell>
  )
}
