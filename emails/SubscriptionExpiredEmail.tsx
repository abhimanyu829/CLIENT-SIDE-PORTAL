import { Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface SubscriptionExpiredEmailProps {
  name: string
  productName: string
  expiredAt: string
  renewUrl: string
}

export default function SubscriptionExpiredEmail({
  name,
  productName,
  expiredAt,
  renewUrl,
}: SubscriptionExpiredEmailProps) {
  const expiredFormatted = new Date(expiredAt).toLocaleDateString("en-US", { dateStyle: "long" })

  return (
    <EmailShell preview={`Your ${productName} subscription has ended — reactivate to restore access`}>
      <Text style={baseStyles.greeting}>Your subscription has ended, {name}</Text>
      <Text style={baseStyles.paragraph}>
        Your <strong>{productName}</strong> subscription expired on <strong>{expiredFormatted}</strong>.
        Your access and credentials have been deactivated.
      </Text>

      <div style={{ ...baseStyles.infoBox, borderLeft: "4px solid #ef4444" }}>
        <Text style={{ ...baseStyles.muted, margin: 0, color: "#ef4444", fontWeight: "600" }}>
          ❌ Access Revoked
        </Text>
        <Text style={{ ...baseStyles.muted, margin: "6px 0 0" }}>
          Your product credentials and API keys are no longer active.
        </Text>
      </div>

      <Link href={renewUrl} style={baseStyles.button}>
        Reactivate Subscription →
      </Link>

      <div style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        💾 <strong>Your data is preserved.</strong> Reactivate at any time to restore full access
        instantly. All your settings and history are still saved.
      </Text>
    </EmailShell>
  )
}
