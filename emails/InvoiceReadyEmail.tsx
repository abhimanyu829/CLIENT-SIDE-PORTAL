import { Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface InvoiceReadyEmailProps {
  name: string
  invoiceNumber: string
  productName: string
  amount: string
  currency: string
  issuedAt: string
  invoiceUrl?: string
  dashboardUrl: string
}

export default function InvoiceReadyEmail({
  name,
  invoiceNumber,
  productName,
  amount,
  currency,
  issuedAt,
  invoiceUrl,
  dashboardUrl,
}: InvoiceReadyEmailProps) {
  const issuedFormatted = new Date(issuedAt).toLocaleDateString("en-US", { dateStyle: "long" })

  return (
    <EmailShell preview={`Invoice ${invoiceNumber} for ${productName} is ready — ${currency} ${amount}`}>
      <Text style={baseStyles.greeting}>🧾 Invoice Ready, {name}</Text>
      <Text style={baseStyles.paragraph}>
        Your invoice for <strong>{productName}</strong> has been generated and is ready for download.
      </Text>

      <div style={baseStyles.infoBox}>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Invoice Number</span>
          <span style={{ ...baseStyles.infoValue, fontFamily: "monospace" }}>{invoiceNumber}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Product</span>
          <span style={baseStyles.infoValue}>{productName}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Amount</span>
          <span style={{ ...baseStyles.infoValue, color: "#16a34a" }}>
            {currency} {amount}
          </span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Issued On</span>
          <span style={baseStyles.infoValue}>{issuedFormatted}</span>
        </div>
      </div>

      {invoiceUrl && (
        <Link href={invoiceUrl} style={baseStyles.button}>
          📥 Download Invoice
        </Link>
      )}

      <Text style={{ ...baseStyles.muted, marginTop: "12px" }}>
        <Link href={dashboardUrl} style={{ color: "#6366f1" }}>
          View in Dashboard →
        </Link>
      </Text>

      <div style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        This invoice is for your records. For billing inquiries, please{" "}
        <Link href={`${dashboardUrl}/tickets`} style={{ color: "#6366f1" }}>
          contact our support team
        </Link>
        .
      </Text>
    </EmailShell>
  )
}
