import { Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface ProductDeliveryEmailProps {
  name: string
  productName: string
  saasUrl?: string
  username?: string
  password?: string
  apiKeys?: string
  onboardingInstructions?: string
  accessDocUrl?: string
  subscriptionDuration?: string
  renewalDate?: string
  supportUrl?: string
}

export default function ProductDeliveryEmail({
  name,
  productName,
  saasUrl,
  username,
  password,
  apiKeys,
  onboardingInstructions,
  accessDocUrl,
  subscriptionDuration,
  renewalDate,
  supportUrl,
}: ProductDeliveryEmailProps) {
  return (
    <EmailShell preview={`Your ${productName} access is ready — log in now`}>
      <Text style={baseStyles.greeting}>Your access is ready, {name}! 🎉</Text>
      <Text style={baseStyles.paragraph}>
        Your purchase of <strong>{productName}</strong> has been fulfilled. Your access credentials
        are below. Keep these secure and do not share them with anyone.
      </Text>

      {(saasUrl || username || password) && (
        <div style={baseStyles.infoBox}>
          <Text style={{ ...baseStyles.muted, fontWeight: "700", marginBottom: "10px" }}>
            🔐 Access Credentials
          </Text>
          {saasUrl && (
            <div style={baseStyles.infoRow}>
              <span style={baseStyles.infoLabel}>Access URL</span>
              <span style={baseStyles.infoValue}>
                <Link href={saasUrl} style={{ color: "#6366f1" }}>{saasUrl}</Link>
              </span>
            </div>
          )}
          {username && (
            <div style={baseStyles.infoRow}>
              <span style={baseStyles.infoLabel}>Username</span>
              <span style={baseStyles.infoValue}>{username}</span>
            </div>
          )}
          {password && (
            <div style={baseStyles.infoRow}>
              <span style={baseStyles.infoLabel}>Password</span>
              <span style={baseStyles.infoValue}>{password}</span>
            </div>
          )}
        </div>
      )}

      {apiKeys && (
        <div style={baseStyles.infoBox}>
          <Text style={{ ...baseStyles.muted, fontWeight: "700", marginBottom: "8px" }}>
            🔑 API Keys
          </Text>
          <Text style={{ ...baseStyles.muted, fontFamily: "monospace", wordBreak: "break-all" as const }}>
            {apiKeys}
          </Text>
        </div>
      )}

      {(subscriptionDuration || renewalDate) && (
        <div style={baseStyles.infoBox}>
          <Text style={{ ...baseStyles.muted, fontWeight: "700", marginBottom: "10px" }}>
            📅 Subscription Details
          </Text>
          {subscriptionDuration && (
            <div style={baseStyles.infoRow}>
              <span style={baseStyles.infoLabel}>Duration</span>
              <span style={baseStyles.infoValue}>{subscriptionDuration}</span>
            </div>
          )}
          {renewalDate && (
            <div style={baseStyles.infoRow}>
              <span style={baseStyles.infoLabel}>Renewal Date</span>
              <span style={baseStyles.infoValue}>{renewalDate}</span>
            </div>
          )}
        </div>
      )}

      {onboardingInstructions && (
        <>
          <Text style={{ ...baseStyles.paragraph, fontWeight: "600" }}>Getting Started</Text>
          <Text style={baseStyles.paragraph}>{onboardingInstructions}</Text>
        </>
      )}

      {saasUrl && (
        <Link href={saasUrl} style={baseStyles.button}>
          Access {productName} →
        </Link>
      )}

      {accessDocUrl && (
        <Text style={{ ...baseStyles.muted, marginTop: "12px" }}>
          📖 <Link href={accessDocUrl} style={{ color: "#6366f1" }}>View Documentation</Link>
        </Text>
      )}

      <div style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        🔒 <strong>Security Notice:</strong> Keep your credentials secure. Do not share them.
        NexusAI will never ask for your password via email or chat.
      </Text>

      {supportUrl && (
        <Text style={baseStyles.muted}>
          Need help? <Link href={supportUrl} style={{ color: "#6366f1" }}>Contact Support</Link>
        </Text>
      )}
    </EmailShell>
  )
}
