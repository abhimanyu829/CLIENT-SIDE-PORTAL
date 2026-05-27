import {
  Button,
  Hr,
  Link,
  Section,
  Text,
  Heading,
} from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")

interface VerificationEmailProps {
  name?: string
  verificationUrl: string
  expiryMinutes?: number
  supportEmail?: string
  ipAddress?: string
  deviceName?: string
}

export const VerificationEmail = ({
  name = "there",
  verificationUrl,
  expiryMinutes = 15,
  supportEmail = "support@nexusai.com",
  ipAddress,
  deviceName,
}: VerificationEmailProps) => (
  <EmailShell
    preview={`Verify your NexusAI account and activate secure access`}
  >
    {/* HERO SECTION */}
    <Section style={{ textAlign: "center", marginBottom: "28px" }}>
      <Text
        style={{
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "1px",
          color: "#6366f1",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        NexusAI Security Verification
      </Text>

      <Heading
        as="h1"
        style={{
          fontSize: "28px",
          lineHeight: "36px",
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 16px",
        }}
      >
        Verify your email address
      </Heading>

      <Text
        style={{
          ...baseStyles.paragraph,
          textAlign: "center",
          maxWidth: "520px",
          margin: "0 auto",
        }}
      >
        Hi {name}, welcome to NexusAI. To securely activate your account,
        subscriptions, AI services, billing access, and dashboard permissions,
        please verify your email address.
      </Text>
    </Section>

    {/* CTA BUTTON */}
    <Section style={{ textAlign: "center", margin: "36px 0" }}>
      <Button
        href={verificationUrl}
        style={{
          ...baseStyles.button,
          backgroundColor: "#6366f1",
          borderRadius: "12px",
          padding: "14px 28px",
          fontWeight: 700,
          fontSize: "15px",
          textDecoration: "none",
          boxShadow: "0 8px 24px rgba(99,102,241,0.25)",
        }}
      >
        Verify Email Address →
      </Button>
    </Section>

    {/* SECURITY INFORMATION */}
    <Section
      style={{
        ...baseStyles.infoBox,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "14px",
        padding: "20px",
        backgroundColor: "#111827",
      }}
    >
      <Text
        style={{
          ...baseStyles.infoLabel,
          fontWeight: 700,
          marginBottom: "10px",
          color: "#ffffff",
        }}
      >
        Verification Details
      </Text>

      <Text style={{ ...baseStyles.infoValue, marginBottom: "8px" }}>
        • This verification link expires in {expiryMinutes} minutes.
      </Text>

      <Text style={{ ...baseStyles.infoValue, marginBottom: "8px" }}>
        • Email verification is required before using subscriptions, AI tools,
        marketplace purchases, or premium features.
      </Text>

      {deviceName && (
        <Text style={{ ...baseStyles.infoValue, marginBottom: "8px" }}>
          • Device: {deviceName}
        </Text>
      )}

      {ipAddress && (
        <Text style={{ ...baseStyles.infoValue }}>
          • Login IP: {ipAddress}
        </Text>
      )}
    </Section>

    {/* FALLBACK LINK */}
    <Section style={{ marginTop: "32px" }}>
      <Text style={baseStyles.paragraph}>
        If the button above doesn't work, copy and paste this secure verification
        link into your browser:
      </Text>

      <Text
        style={{
          ...baseStyles.muted,
          wordBreak: "break-all",
          fontSize: "12px",
          lineHeight: "20px",
          backgroundColor: "#0f172a",
          padding: "14px",
          borderRadius: "10px",
        }}
      >
        {verificationUrl}
      </Text>
    </Section>

    <Hr style={baseStyles.divider} />

    {/* SECURITY WARNING */}
    <Section>
      <Text
        style={{
          ...baseStyles.paragraph,
          fontWeight: 600,
          color: "#fbbf24",
        }}
      >
        Security Notice
      </Text>

      <Text style={baseStyles.muted}>
        For your security, never share this verification link with anyone. NexusAI
        support will never ask for your verification token or password.
      </Text>

      <Text style={baseStyles.muted}>
        If you did not create a NexusAI account, you can safely ignore this email.
        No account or subscription will be activated without successful
        verification.
      </Text>
    </Section>

    {/* SUPPORT */}
    <Section style={{ marginTop: "28px" }}>
      <Text style={baseStyles.muted}>
        Need help? Contact our support team:
      </Text>

      <Link
        href={`mailto:${supportEmail}`}
        style={{
          color: "#818cf8",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        {supportEmail}
      </Link>
    </Section>

    {/* FOOTER */}
    <Section style={{ marginTop: "40px", textAlign: "center" }}>
      <Text
        style={{
          ...baseStyles.muted,
          fontSize: "11px",
          lineHeight: "18px",
        }}
      >
        © {new Date().getFullYear()} NexusAI Technologies.
        <br />
        Enterprise AI Infrastructure • Secure Commerce • SaaS Ecosystem
      </Text>
    </Section>
  </EmailShell>
)

VerificationEmail.PreviewProps = {
  name: "Jane Doe",
  verificationUrl: `${BASE_URL}/verify-email?token=abc123`,
  expiryMinutes: 15,
  supportEmail: "support@nexusai.com",
  ipAddress: "192.168.1.1",
  deviceName: "Chrome on Windows",
} satisfies VerificationEmailProps

export default VerificationEmail