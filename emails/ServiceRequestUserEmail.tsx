import { Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface ServiceRequestUserEmailProps {
  name: string
  servicePageTitle: string | null
  type: string
  orderRef?: string | null
  adminUrl: string
}

export default function ServiceRequestUserEmail({
  name,
  servicePageTitle,
  type,
  orderRef,
  adminUrl,
}: ServiceRequestUserEmailProps) {
  return (
    <EmailShell preview={`Your ${type.toLowerCase()} request was received`}>
      <Text style={baseStyles.greeting}>Hi {name},</Text>
      <Text style={baseStyles.paragraph}>
        We received your {type.toLowerCase()} request{servicePageTitle ? ` for ${servicePageTitle}` : ""}.
      </Text>
      <Text style={baseStyles.paragraph}>
        {orderRef ? (
          <>
            <strong>Order reference:</strong> {orderRef}
          </>
        ) : (
          "Our team will review the request details you provided."
        )}
      </Text>
      <Text style={baseStyles.paragraph}>
        The request has been routed to the NexusAI service operations team and is now waiting for review.
      </Text>
      <Text style={baseStyles.muted}>
        You can continue tracking service updates from the admin service center.
      </Text>
      <a href={adminUrl} style={baseStyles.button}>Open Service Center</a>
    </EmailShell>
  )
}
