import { Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface RefundRequestedAdminEmailProps {
  adminEmail: string
  userName: string
  userEmail: string
  productName: string
  reason: string
  refundAmount: string
  currency: string
  refundRequestId: string
  adminUrl: string
}

export default function RefundRequestedAdminEmail({
  adminEmail,
  userName,
  userEmail,
  productName,
  reason,
  refundAmount,
  currency,
  refundRequestId,
  adminUrl,
}: RefundRequestedAdminEmailProps) {
  return (
    <EmailShell preview={`[Action Required] Refund request from ${userName} — ${currency} ${refundAmount}`}>
      <Text style={baseStyles.greeting}>⚠️ New Refund Request</Text>
      <Text style={baseStyles.paragraph}>
        A refund request has been submitted and requires your review. Auto-refund may have been
        initiated if the request was within the 3-hour eligibility window.
      </Text>

      <div style={{ ...baseStyles.infoBox, borderLeft: "4px solid #f59e0b" }}>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Request ID</span>
          <span style={{ ...baseStyles.infoValue, fontFamily: "monospace", fontSize: "11px" }}>
            {refundRequestId}
          </span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Customer</span>
          <span style={baseStyles.infoValue}>{userName} ({userEmail})</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Product</span>
          <span style={baseStyles.infoValue}>{productName}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Refund Amount</span>
          <span style={{ ...baseStyles.infoValue, color: "#ef4444" }}>
            {currency} {refundAmount}
          </span>
        </div>
      </div>

      <Text style={{ ...baseStyles.paragraph, fontWeight: "600" }}>Reason provided:</Text>
      <div style={{ ...baseStyles.infoBox, borderLeft: "4px solid #6366f1" }}>
        <Text style={{ ...baseStyles.muted, margin: 0, fontStyle: "italic" }}>&quot;{reason}&quot;</Text>
      </div>

      <Link href={adminUrl} style={baseStyles.button}>
        Review Refund Request →
      </Link>

      <div style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        ✅ If within the 3-hour window, the refund was processed automatically via the payment gateway.
        Review this request to confirm, add notes, or override if needed.
      </Text>
    </EmailShell>
  )
}
