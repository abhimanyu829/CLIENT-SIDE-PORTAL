import { Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface SubscriptionExpiryWarningEmailProps {
  name: string
  productName: string
  daysUntilExpiry: number
  expiryDate: string
  renewUrl: string
  amount?: string
  currency?: string
}

export default function SubscriptionExpiryWarningEmail({
  name,
  productName,
  daysUntilExpiry,
  expiryDate,
  renewUrl,
  amount,
  currency = "USD",
}: SubscriptionExpiryWarningEmailProps) {
  const isUrgent = daysUntilExpiry <= 1

  return (
    <EmailShell
      preview={`Action needed: Your ${productName} subscription expires in ${daysUntilExpiry} day(s)`}
    >
      <Text style={baseStyles.greeting}>
        {isUrgent ? "⚠️ " : "📅 "}Your subscription expires {isUrgent ? "tomorrow" : `in ${daysUntilExpiry} days`}, {name}
      </Text>
      <Text style={baseStyles.paragraph}>
        Your <strong>{productName}</strong> subscription is expiring soon. Renew now to keep
        uninterrupted access to all features and your credentials.
      </Text>

      <div style={{ ...baseStyles.infoBox, borderLeft: `4px solid ${isUrgent ? "#ef4444" : "#f59e0b"}` }}>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Product</span>
          <span style={baseStyles.infoValue}>{productName}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Expires On</span>
          <span style={{ ...baseStyles.infoValue, color: isUrgent ? "#ef4444" : "#f59e0b" }}>
            {expiryDate}
          </span>
        </div>
        {amount && (
          <div style={baseStyles.infoRow}>
            <span style={baseStyles.infoLabel}>Renewal Amount</span>
            <span style={baseStyles.infoValue}>{currency} {amount}</span>
          </div>
        )}
      </div>

      <Link href={renewUrl} style={baseStyles.button}>
        Renew Subscription →
      </Link>

      <div style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        ⚠️ After expiry, your access and credentials will be automatically revoked. Your data is
        preserved and will be restored upon renewal.
      </Text>
    </EmailShell>
  )
}
