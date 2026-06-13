import { Button, Hr, Section, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nexusai.com"

interface PaymentFailedEmailProps {
  name: string
  planName: string
  amount: string
  failedAt: string
  retryDate?: string
  updateUrl?: string
}

export const PaymentFailedEmail = ({
  name,
  planName,
  amount,
  failedAt,
  retryDate,
  updateUrl = `${BASE_URL}/dashboard/subscriptions`,
}: PaymentFailedEmailProps) => (
  <EmailShell
    preview="Action required: Your payment could not be processed"
    footerNote="We'll automatically retry your payment. Update your card to avoid service interruption."
  >
    <Text style={baseStyles.greeting}>Payment failed ⚠️</Text>

    <Text style={baseStyles.paragraph}>Hi {name},</Text>

    <Text style={baseStyles.paragraph}>
      We were unable to process the payment for your <strong>{planName}</strong>{" "}
      subscription. To keep your account active and avoid losing access to your features,
      please update your payment method as soon as possible.
    </Text>

    {/* Failure details */}
    <Section
      style={{
        ...baseStyles.infoBox,
        backgroundColor: "#fff1f2",
        border: "1px solid #fecdd3",
      }}
    >
      {[
        ["Plan", planName],
        ["Amount", amount],
        ["Failed On", failedAt],
        ...(retryDate ? [["Next Retry", retryDate] as [string, string]] : []),
        ["Status", "✗ PAYMENT FAILED"],
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
              color: label === "Status" ? "#dc2626" : "#0f172a",
            }}
          >
            {value}
          </Text>
        </Section>
      ))}
    </Section>

    <Text style={baseStyles.paragraph}>
      Common reasons for payment failure include an expired card, insufficient funds, or
      incorrect billing details. Updating your payment method takes less than a minute.
    </Text>

    <Section style={{ textAlign: "center" as const, margin: "28px 0 8px" }}>
      <Button href={updateUrl} style={baseStyles.buttonDanger}>
        Update Payment Method →
      </Button>
    </Section>

    <Hr style={baseStyles.divider} />

    <Text style={baseStyles.muted}>
      If you believe this is an error or need assistance, please reply to this email or
      contact our support team. We're here to help.
    </Text>
  </EmailShell>
)

PaymentFailedEmail.PreviewProps = {
  name: "Jane Doe",
  planName: "Pro — Monthly",
  amount: "$49.00",
  failedAt: "May 13, 2025",
  retryDate: "May 16, 2025",
} satisfies PaymentFailedEmailProps

export default PaymentFailedEmail
