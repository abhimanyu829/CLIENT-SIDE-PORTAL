import { Button, Hr, Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nexusai.com"

interface SubscriptionRenewalEmailProps {
  name: string
  planName: string
  amount: string
  currency?: string
  renewalDate: string
  cardLast4?: string
  manageUrl?: string
  cancelUrl?: string
}

export const SubscriptionRenewalEmail = ({
  name,
  planName,
  amount,
  currency = "USD",
  renewalDate,
  cardLast4,
  manageUrl = `${BASE_URL}/dashboard/subscriptions`,
  cancelUrl = `${BASE_URL}/dashboard/subscriptions`,
}: SubscriptionRenewalEmailProps) => (
  <EmailShell
    preview={`Your ${planName} subscription renews on ${renewalDate} — ${amount} ${currency}`}
    footerNote="You're receiving this reminder 7 days before your subscription renewal date."
  >
    <Text style={baseStyles.greeting}>Subscription renewal reminder</Text>

    <Text style={baseStyles.paragraph}>Hi {name},</Text>

    <Text style={baseStyles.paragraph}>
      Just a heads-up: your <strong>{planName}</strong> subscription is set to
      automatically renew on <strong>{renewalDate}</strong>. No action is needed unless
      you'd like to make changes.
    </Text>

    {/* Renewal details */}
    <Section style={baseStyles.infoBox}>
      {[
        ["Plan", planName],
        ["Renewal Amount", `${amount} ${currency}`],
        ["Renewal Date", renewalDate],
        ...(cardLast4 ? [["Payment Method", `•••• •••• •••• ${cardLast4}`] as [string, string]] : []),
        ["Status", "✓ ACTIVE"],
      ].map(([label, value]) => (
        <Section
          key={label}
          style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}
        >
          <Text style={{ ...baseStyles.infoLabel, margin: 0, display: "inline" }}>{label}</Text>
          <Text
            style={{
              ...baseStyles.infoValue,
              margin: 0,
              display: "inline",
              color: label === "Status" ? "#16a34a" : "#0f172a",
            }}
          >
            {value}
          </Text>
        </Section>
      ))}
    </Section>

    <Section style={{ textAlign: "center" as const, margin: "28px 0 8px" }}>
      <Button href={manageUrl} style={baseStyles.button}>
        Manage Subscription →
      </Button>
    </Section>

    <Hr style={baseStyles.divider} />

    <Text style={baseStyles.muted}>
      Want to change your plan or cancel?{" "}
      <Link href={cancelUrl} style={{ color: "#6366f1" }}>
        Visit your subscription settings
      </Link>
      . Changes made before the renewal date will take effect immediately.
    </Text>

    <Text style={baseStyles.muted}>
      Need an invoice or have a billing question? Reply to this email — our billing team
      typically responds within 1 business day.
    </Text>
  </EmailShell>
)

SubscriptionRenewalEmail.PreviewProps = {
  name: "Jane Doe",
  planName: "Pro — Monthly",
  amount: "$49.00",
  currency: "USD",
  renewalDate: "May 20, 2025",
  cardLast4: "4242",
} satisfies SubscriptionRenewalEmailProps

export default SubscriptionRenewalEmail
