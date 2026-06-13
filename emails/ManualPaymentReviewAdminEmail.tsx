import { Button, Hr, Section, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface ManualPaymentReviewAdminEmailProps {
  adminName: string
  adminEmail: string
  orderNumber: string
  orderId: string
  userEmail: string
  productSummary: string
  claimedUtr: string
  claimedAmount: string
  expectedAmount: string
  currency: string
  reviewUrl: string
}

export default function ManualPaymentReviewAdminEmail({
  adminName,
  adminEmail,
  orderNumber,
  orderId,
  userEmail,
  productSummary,
  claimedUtr,
  claimedAmount,
  expectedAmount,
  currency,
  reviewUrl,
}: ManualPaymentReviewAdminEmailProps) {
  return (
    <EmailShell preview={`Manual payment review required for ${orderNumber}`}>
      <Text style={baseStyles.greeting}>Manual payment verification required</Text>
      <Text style={baseStyles.paragraph}>Hi {adminName},</Text>
      <Text style={baseStyles.paragraph}>
        A user has submitted a UPI/QR payment proof that requires backend review before the order can be activated.
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.infoLabel, margin: "0 0 8px" }}>Review details</Text>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Order ID</span>
          <span style={{ ...baseStyles.infoValue, fontFamily: "monospace" }}>{orderId}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Order Number</span>
          <span style={baseStyles.infoValue}>{orderNumber}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Customer</span>
          <span style={baseStyles.infoValue}>{userEmail}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Products</span>
          <span style={baseStyles.infoValue}>{productSummary}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Claimed UTR</span>
          <span style={{ ...baseStyles.infoValue, fontFamily: "monospace" }}>{claimedUtr}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Claimed Amount</span>
          <span style={baseStyles.infoValue}>
            {currency} {claimedAmount}
          </span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Expected Amount</span>
          <span style={baseStyles.infoValue}>
            {currency} {expectedAmount}
          </span>
        </div>
      </Section>

      <Text style={baseStyles.paragraph}>
        Please open the manual verification queue and enter the actual transaction ID and actual amount received. The backend will compare your entry against the stored claims and order snapshot before activating the subscription.
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <Button href={reviewUrl} style={baseStyles.button}>
          Review Payment →
        </Button>
      </Section>

      <Hr style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        This alert was sent to {adminEmail}. If the details do not match, the system will request a single recheck before failing the payment.
      </Text>
      <Text style={baseStyles.muted}>
        Keep manual approvals backend-driven and do not trust any frontend-entered values without the server comparison.
      </Text>
    </EmailShell>
  )
}
