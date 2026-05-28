import { Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface LoginAlertEmailProps {
  name: string
  ipAddress?: string
  userAgent?: string
  location?: string
  loginAt: string
  securityUrl: string
}

export default function LoginAlertEmail({
  name,
  ipAddress,
  userAgent,
  location,
  loginAt,
  securityUrl,
}: LoginAlertEmailProps) {
  const loginFormatted = new Date(loginAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <EmailShell preview={`New sign-in to your NexusAI account — ${loginFormatted}`}>
      <Text style={baseStyles.greeting}>🔔 New Sign-In Detected, {name}</Text>
      <Text style={baseStyles.paragraph}>
        We detected a new sign-in to your NexusAI account. If this was you, no action is needed.
      </Text>

      <div style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.muted, fontWeight: "700", marginBottom: "10px" }}>
          Sign-In Details
        </Text>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Time</span>
          <span style={baseStyles.infoValue}>{loginFormatted}</span>
        </div>
        {ipAddress && (
          <div style={baseStyles.infoRow}>
            <span style={baseStyles.infoLabel}>IP Address</span>
            <span style={baseStyles.infoValue}>{ipAddress}</span>
          </div>
        )}
        {location && (
          <div style={baseStyles.infoRow}>
            <span style={baseStyles.infoLabel}>Location</span>
            <span style={baseStyles.infoValue}>{location}</span>
          </div>
        )}
        {userAgent && (
          <div style={baseStyles.infoRow}>
            <span style={baseStyles.infoLabel}>Device / Browser</span>
            <span style={{ ...baseStyles.infoValue, fontSize: "11px", fontFamily: "monospace" }}>
              {userAgent.length > 80 ? userAgent.slice(0, 80) + "..." : userAgent}
            </span>
          </div>
        )}
      </div>

      <Text style={baseStyles.paragraph}>
        If this <strong>was not you</strong>, your account may be compromised. Secure it immediately:
      </Text>

      <Link href={securityUrl} style={baseStyles.buttonDanger}>
        🔒 Secure My Account
      </Link>

      <div style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        If this was you signing in, you can safely ignore this email. You&apos;ll receive this
        notification for every new device sign-in for your security.
      </Text>
    </EmailShell>
  )
}
