import { Button, Hr, Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nexusai.com"

interface WelcomeEmailProps {
  name: string
  email?: string
  dashboardUrl?: string
}

export const WelcomeEmail = ({
  name,
  email,
  dashboardUrl = `${BASE_URL}/dashboard`,
}: WelcomeEmailProps) => (
  <EmailShell preview={`Welcome to NexusAI, ${name}! Your account is ready.`}>
    <Text style={baseStyles.greeting}>Welcome aboard, {name}! 🎉</Text>

    <Text style={baseStyles.paragraph}>
      We're thrilled to have you join NexusAI. Your account is all set up and ready
      to go. Here's everything you can do on day one:
    </Text>

    {/* Feature list */}
    {[
      "🤖  Chat with your AI assistant — 24/7 support at your fingertips",
      "📊  Browse the marketplace — discover tools built for your workflow",
      "🎫  Submit support tickets — our team is always ready to help",
      "💳  Manage your subscription — upgrade anytime, cancel anytime",
    ].map((item, i) => (
      <Text key={i} style={{ ...baseStyles.paragraph, margin: "0 0 8px", paddingLeft: "8px" }}>
        {item}
      </Text>
    ))}

    {/* Info box */}
    <Section style={baseStyles.infoBox}>
      <Text style={{ ...baseStyles.infoLabel, marginBottom: "4px" }}>Your account email</Text>
      <Text style={{ ...baseStyles.infoValue, margin: 0 }}>{email ?? name}</Text>
    </Section>

    <Section style={{ textAlign: "center" as const, margin: "28px 0 8px" }}>
      <Button href={dashboardUrl} style={baseStyles.button}>
        Go to Your Dashboard →
      </Button>
    </Section>

    <Hr style={baseStyles.divider} />

    <Text style={baseStyles.muted}>
      Need help getting started?{" "}
      <Link href={`${BASE_URL}/docs`} style={{ color: "#6366f1" }}>
        Read the documentation
      </Link>{" "}
      or reply to this email — we respond to every message.
    </Text>
  </EmailShell>
)

WelcomeEmail.PreviewProps = {
  name: "Jane Doe",
  email: "jane@example.com",
} satisfies WelcomeEmailProps

export default WelcomeEmail
