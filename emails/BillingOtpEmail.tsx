import { Hr, Section, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface BillingOtpEmailProps {
  customerName?: string
  otp: string
  expiryMinutes?: number
  billingEmail?: string
}

export const BillingOtpEmail = ({
  customerName = "there",
  otp,
  expiryMinutes = 10,
  billingEmail,
}: BillingOtpEmailProps) => (
  <EmailShell
    preview={`Your NexusAI billing verification code: ${otp}`}
    brandTagline="Secure Billing Verification"
  >
    {/* Greeting */}
    <Text style={baseStyles.greeting}>Hi {customerName},</Text>
    <Text style={baseStyles.paragraph}>
      You requested a billing verification code to complete your NexusAI
      checkout. Use the code below to verify your billing email address.
    </Text>

    {/* OTP Block */}
    <Section
      style={{
        backgroundColor: "#0f172a",
        borderRadius: "12px",
        padding: "28px 20px",
        textAlign: "center" as const,
        margin: "24px 0",
        border: "1px solid rgba(99,102,241,0.3)",
      }}
    >
      <Text
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "2px",
          color: "#6366f1",
          textTransform: "uppercase" as const,
          margin: "0 0 12px",
        }}
      >
        Billing Verification Code
      </Text>
      <Text
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "38px",
          fontWeight: 700,
          letterSpacing: "0.3em",
          color: "#ffffff",
          margin: "0 0 12px",
          lineHeight: "1",
        }}
      >
        {otp}
      </Text>
      <Text
        style={{
          fontSize: "13px",
          color: "#94a3b8",
          margin: 0,
        }}
      >
        Expires in{" "}
        <strong style={{ color: "#f59e0b" }}>{expiryMinutes} minutes</strong>
      </Text>
    </Section>

    {/* Details box */}
    <Section style={baseStyles.infoBox}>
      <Text style={{ ...baseStyles.infoLabel, fontWeight: 700, marginBottom: "8px" }}>
        Verification Details
      </Text>
      {billingEmail && (
        <Text style={{ ...baseStyles.infoValue, margin: "4px 0" }}>
          • Billing email: <strong>{billingEmail}</strong>
        </Text>
      )}
      <Text style={{ ...baseStyles.infoValue, margin: "4px 0" }}>
        • Code expires in {expiryMinutes} minutes
      </Text>
      <Text style={{ ...baseStyles.infoValue, margin: "4px 0" }}>
        • This code is single-use only
      </Text>
    </Section>

    <Hr style={baseStyles.divider} />

    {/* Security notice */}
    <Section>
      <Text
        style={{
          ...baseStyles.paragraph,
          fontWeight: 600,
          color: "#fbbf24",
        }}
      >
        🔒 Security Notice
      </Text>
      <Text style={baseStyles.muted}>
        <strong>Never share this code with anyone.</strong> NexusAI support
        will never ask for your verification code. This code is only valid for
        your current checkout session.
      </Text>
      <Text style={baseStyles.muted}>
        If you did not initiate a checkout, you can safely ignore this email.
        No payment or order will be created without your action.
      </Text>
    </Section>
  </EmailShell>
)

BillingOtpEmail.PreviewProps = {
  customerName: "Jane Doe",
  otp: "A3F7B2C9",
  expiryMinutes: 10,
  billingEmail: "billing@company.com",
} satisfies BillingOtpEmailProps

export default BillingOtpEmail
