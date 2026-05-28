import { Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface PreviewStartedEmailProps {
  name: string
  productName: string
  previewUrl?: string
  expiresAt: string
  durationMinutes: number
}

export default function PreviewStartedEmail({
  name,
  productName,
  previewUrl,
  expiresAt,
  durationMinutes,
}: PreviewStartedEmailProps) {
  const expiryFormatted = new Date(expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <EmailShell preview={`Your ${productName} preview is active — ${durationMinutes} minutes to explore`}>
      <Text style={baseStyles.greeting}>⚡ Your preview is live, {name}!</Text>
      <Text style={baseStyles.paragraph}>
        Your <strong>{durationMinutes}-minute preview</strong> of <strong>{productName}</strong> is
        now active. You have full access to explore the product during this session.
      </Text>

      <div style={baseStyles.infoBox}>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Session Duration</span>
          <span style={baseStyles.infoValue}>{durationMinutes} minutes</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Expires At</span>
          <span style={baseStyles.infoValue}>{expiryFormatted}</span>
        </div>
      </div>

      {previewUrl && (
        <Link href={previewUrl} style={baseStyles.button}>
          Launch Preview →
        </Link>
      )}

      <div style={baseStyles.divider} />

      <Text style={baseStyles.paragraph}>
        Enjoyed what you saw? Purchase <strong>{productName}</strong> for unlimited, permanent access
        with full credentials and support.
      </Text>

      <Text style={baseStyles.muted}>
        ⚠️ Preview sessions expire automatically and cannot be reused. Each session is tracked for
        security purposes.
      </Text>
    </EmailShell>
  )
}
