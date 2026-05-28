import { Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface RefundConfirmationEmailProps {
  name: string
  productName: string
  refundAmount: string
  currency: string
  gateway: string
  gatewayRefundId?: string
  estimatedDays?: string
}

export default function RefundConfirmationEmail({
  name,
  productName,
  refundAmount,
  currency,
  gateway,
  gatewayRefundId,
  estimatedDays = "5-7",
}: RefundConfirmationEmailProps) {
  return (
    <EmailShell preview={`Your refund of ${currency} ${refundAmount} for ${productName} has been processed`}>
      <Text style={baseStyles.greeting}>↩️ Refund Confirmed, {name}</Text>
      <Text style={baseStyles.paragraph}>
        Your refund request for <strong>{productName}</strong> has been processed. Here are the
        details of your refund:
      </Text>

      <div style={baseStyles.infoBox}>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Product</span>
          <span style={baseStyles.infoValue}>{productName}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Refund Amount</span>
          <span style={{ ...baseStyles.infoValue, color: "#16a34a" }}>
            {currency} {refundAmount}
          </span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Payment Gateway</span>
          <span style={baseStyles.infoValue}>{gateway}</span>
        </div>
        {gatewayRefundId && (
          <div style={baseStyles.infoRow}>
            <span style={baseStyles.infoLabel}>Reference ID</span>
            <span style={{ ...baseStyles.infoValue, fontFamily: "monospace", fontSize: "11px" }}>
              {gatewayRefundId}
            </span>
          </div>
        )}
      </div>

      <Text style={baseStyles.paragraph}>
        ⏱️ Refunds typically appear within <strong>{estimatedDays} business days</strong> depending on
        your bank or card issuer.
      </Text>

      <Text style={baseStyles.paragraph}>
        Your access to <strong>{productName}</strong> has been deactivated as part of this refund.
      </Text>

      <div style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        If you did not request this refund or have any questions, please{" "}
        <Link href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/tickets`} style={{ color: "#6366f1" }}>
          contact our support team immediately
        </Link>
        .
      </Text>
    </EmailShell>
  )
}
