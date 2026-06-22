import { Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface ServiceRequestAdminEmailProps {
  name: string
  email: string
  type: string
  orderRef?: string | null
  reason: string
  servicePageTitle: string | null
  adminUrl: string
}

export default function ServiceRequestAdminEmail({
  name,
  email,
  type,
  orderRef,
  reason,
  servicePageTitle,
  adminUrl,
}: ServiceRequestAdminEmailProps) {
  return (
    <EmailShell preview={`New ${type.toLowerCase()} request`}>
      <Text style={baseStyles.greeting}>New service request</Text>
      <Text style={baseStyles.paragraph}>
        A {type.toLowerCase()} request was submitted {servicePageTitle ? `for ${servicePageTitle}` : "for a service page"}.
      </Text>
      <Text style={baseStyles.paragraph}><strong>Name:</strong> {name}</Text>
      <Text style={baseStyles.paragraph}><strong>Email:</strong> {email}</Text>
      <Text style={baseStyles.paragraph}><strong>Order ref:</strong> {orderRef || "N/A"}</Text>
      <Text style={baseStyles.paragraph}><strong>Reason:</strong> {reason}</Text>
      <Text style={baseStyles.muted}>Review it in the service request center.</Text>
      <a href={adminUrl} style={baseStyles.button}>Open Service Requests</a>
    </EmailShell>
  )
}
