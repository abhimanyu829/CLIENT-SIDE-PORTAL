import { Button, Hr, Section, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://yourapp.com"

interface InvoiceEmailProps {
  name: string
  invoiceNumber: string
  invoiceUrl: string
  amount: string
  currency?: string
  issuedAt: string
  planName: string
  periodStart: string
  periodEnd: string
}

export const InvoiceEmail = ({
  name,
  invoiceNumber,
  invoiceUrl,
  amount,
  currency = "USD",
  issuedAt,
  planName,
  periodStart,
  periodEnd,
}: InvoiceEmailProps) => (
  <EmailShell
    preview={`Invoice ${invoiceNumber} — ${amount} ${currency} — Payment confirmed`}
    footerNote="This invoice was generated automatically. Keep it for your records."
  >
    <Text style={baseStyles.greeting}>Payment received ✓</Text>

    <Text style={baseStyles.paragraph}>Hi {name},</Text>

    <Text style={baseStyles.paragraph}>
      Thank you for your payment! Your subscription is active and your invoice is ready
      to download. Here's a summary of your transaction:
    </Text>

    {/* Invoice details */}
    <Section style={baseStyles.infoBox}>
      {[
        ["Invoice #", invoiceNumber],
        ["Plan", planName],
        ["Amount Paid", `${amount} ${currency}`],
        ["Issue Date", issuedAt],
        ["Billing Period", `${periodStart} – ${periodEnd}`],
        ["Status", "✓ PAID"],
      ].map(([label, value]) => (
        <Section
          key={label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "5px 0",
            borderBottom: "1px solid #e2e8f0",
          }}
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
      <Button href={invoiceUrl} style={baseStyles.button}>
        Download PDF Invoice →
      </Button>
    </Section>

    <Hr style={baseStyles.divider} />

    <Text style={baseStyles.muted}>
      You can view all your invoices anytime from your{" "}
      <a href={`${BASE_URL}/dashboard/invoices`} style={{ color: "#6366f1" }}>
        billing dashboard
      </a>
      . Questions? Reply to this email.
    </Text>
  </EmailShell>
)

InvoiceEmail.PreviewProps = {
  name: "Jane Doe",
  invoiceNumber: "INV-2025-0042",
  invoiceUrl: "https://yourapp.com/invoices/inv_abc123.pdf",
  amount: "$49.00",
  currency: "USD",
  issuedAt: "May 13, 2025",
  planName: "Pro — Monthly",
  periodStart: "May 13, 2025",
  periodEnd: "Jun 13, 2025",
} satisfies InvoiceEmailProps

export default InvoiceEmail
