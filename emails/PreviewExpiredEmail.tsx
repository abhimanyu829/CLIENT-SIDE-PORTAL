import { Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface PreviewExpiredEmailProps {
  name: string
  productName: string
  productSlug: string
  appUrl: string
}

export default function PreviewExpiredEmail({
  name,
  productName,
  productSlug,
  appUrl,
}: PreviewExpiredEmailProps) {
  const buyUrl = `${appUrl}/marketplace/${productSlug}`

  return (
    <EmailShell preview={`Your ${productName} preview has ended — buy now for full access`}>
      <Text style={baseStyles.greeting}>Your preview has ended, {name}</Text>
      <Text style={baseStyles.paragraph}>
        Your preview session for <strong>{productName}</strong> has expired. We hope you enjoyed
        exploring the product!
      </Text>

      <Text style={{ ...baseStyles.paragraph, fontWeight: "600" }}>
        Ready to get full, permanent access?
      </Text>

      <div style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.muted, margin: "0 0 6px" }}>
          ✅ Unlimited access — no time limits
        </Text>
        <Text style={{ ...baseStyles.muted, margin: "0 0 6px" }}>
          ✅ Full credentials delivered instantly
        </Text>
        <Text style={{ ...baseStyles.muted, margin: "0" }}>
          ✅ Priority support included
        </Text>
      </div>

      <Link href={buyUrl} style={baseStyles.button}>
        Buy {productName} — Get Full Access →
      </Link>

      <div style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        Questions about {productName}?{" "}
        <Link href={`${appUrl}/marketplace/${productSlug}`} style={{ color: "#6366f1" }}>
          View product details
        </Link>{" "}
        or{" "}
        <Link href={`${appUrl}/dashboard/tickets`} style={{ color: "#6366f1" }}>
          contact our team
        </Link>
        .
      </Text>
    </EmailShell>
  )
}
