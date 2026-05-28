import { Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface SuspiciousActivityEmailProps {
  name: string
  activityType: string
  details: string
  detectedAt: string
  securityUrl: string
}

export default function SuspiciousActivityEmail({
  name,
  activityType,
  details,
  detectedAt,
  securityUrl,
}: SuspiciousActivityEmailProps) {
  const detectedFormatted = new Date(detectedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <EmailShell preview={`⚠️ Suspicious activity detected on your NexusAI account`}>
      <Text style={baseStyles.greeting}>🚨 Security Alert, {name}</Text>
      <Text style={baseStyles.paragraph}>
        We detected suspicious activity on your NexusAI account. If this was you, you can safely
        ignore this email. Otherwise, secure your account immediately.
      </Text>

      <div style={{ ...baseStyles.infoBox, borderLeft: "4px solid #ef4444" }}>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Activity Type</span>
          <span style={{ ...baseStyles.infoValue, color: "#ef4444" }}>{activityType}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Detected At</span>
          <span style={baseStyles.infoValue}>{detectedFormatted}</span>
        </div>
        <div style={{ ...baseStyles.infoRow, flexDirection: "column" as const }}>
          <span style={{ ...baseStyles.infoLabel, marginBottom: "4px" }}>Details</span>
          <span style={{ ...baseStyles.infoValue, fontSize: "12px" }}>{details}</span>
        </div>
      </div>

      <Text style={baseStyles.paragraph}>
        If this <strong>was not you</strong>, your account may be at risk:
      </Text>

      <Link href={securityUrl} style={baseStyles.buttonDanger}>
        🔒 Secure My Account Now
      </Link>

      <div style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        Recommended actions if you suspect unauthorized access:
      </Text>
      <Text style={{ ...baseStyles.muted, margin: "0 0 4px" }}>• Change your password immediately</Text>
      <Text style={{ ...baseStyles.muted, margin: "0 0 4px" }}>• Enable two-factor authentication</Text>
      <Text style={{ ...baseStyles.muted, margin: "0 0 4px" }}>• Review recent account activity</Text>
      <Text style={{ ...baseStyles.muted, margin: "0" }}>
        • <Link href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/tickets`} style={{ color: "#6366f1" }}>
            Contact our security team
          </Link>
      </Text>
    </EmailShell>
  )
}
