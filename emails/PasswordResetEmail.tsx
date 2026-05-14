import { Button, Hr, Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://yourapp.com"

interface PasswordResetEmailProps {
  name: string
  resetLink: string
  expiresInHours?: number
}

export const PasswordResetEmail = ({
  name,
  resetLink,
  expiresInHours = 2,
}: PasswordResetEmailProps) => (
  <EmailShell
    preview="Reset your YourApp password — link expires soon"
    footerNote="If you didn't request this, please ignore this email. Your password will not change."
  >
    <Text style={baseStyles.greeting}>Password reset request</Text>

    <Text style={baseStyles.paragraph}>Hi {name},</Text>

    <Text style={baseStyles.paragraph}>
      We received a request to reset the password for your YourApp account. Click the
      button below to choose a new password. This link is valid for{" "}
      <strong>{expiresInHours} hours</strong>.
    </Text>

    <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
      <Button href={resetLink} style={baseStyles.buttonDanger}>
        Reset My Password
      </Button>
    </Section>

    {/* Security info box */}
    <Section style={baseStyles.infoBox}>
      <Text style={{ ...baseStyles.infoLabel, margin: "0 0 4px" }}>🔒 Security notice</Text>
      <Text style={{ ...baseStyles.muted, margin: 0 }}>
        This link can only be used once and will expire in {expiresInHours} hours. If you
        didn't request a password reset, your account is still secure — no action needed.
      </Text>
    </Section>

    <Hr style={baseStyles.divider} />

    <Text style={baseStyles.muted}>
      If the button above doesn't work, copy and paste this link into your browser:
    </Text>
    <Text style={{ ...baseStyles.muted, wordBreak: "break-all" }}>
      <Link href={resetLink} style={{ color: "#6366f1" }}>
        {resetLink}
      </Link>
    </Text>
  </EmailShell>
)

PasswordResetEmail.PreviewProps = {
  name: "Jane Doe",
  resetLink: "https://yourapp.com/auth/reset?token=abc123",
  expiresInHours: 2,
} satisfies PasswordResetEmailProps

export default PasswordResetEmail
