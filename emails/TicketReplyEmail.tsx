import { Button, Hr, Section, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://yourapp.com"

interface TicketReplyEmailProps {
  name: string
  ticketId: string
  ticketTitle: string
  replySnippet: string
  replierName: string
  ticketUrl?: string
}

export const TicketReplyEmail = ({
  name,
  ticketId,
  ticketTitle,
  replySnippet,
  replierName,
  ticketUrl,
}: TicketReplyEmailProps) => {
  const url = ticketUrl ?? `${BASE_URL}/dashboard/tickets/${ticketId}`

  return (
    <EmailShell
      preview={`New reply on: ${ticketTitle}`}
      footerNote="You're receiving this because you have an active support ticket. Reply to this email or visit your dashboard to respond."
    >
      <Text style={baseStyles.greeting}>New reply on your ticket</Text>

      <Text style={baseStyles.paragraph}>Hi {name},</Text>

      <Text style={baseStyles.paragraph}>
        <strong>{replierName}</strong> has replied to your support ticket:
      </Text>

      {/* Ticket info box */}
      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.infoLabel, margin: "0 0 6px" }}>
          Ticket #{ticketId.slice(0, 8).toUpperCase()}
        </Text>
        <Text style={{ ...baseStyles.infoValue, margin: "0 0 12px" }}>{ticketTitle}</Text>
        <Hr style={{ borderTop: "1px solid #e2e8f0", margin: "8px 0 12px" }} />
        <Text style={{ ...baseStyles.muted, margin: 0, fontStyle: "italic" }}>
          "{replySnippet}"
        </Text>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0 8px" }}>
        <Button href={url} style={baseStyles.button}>
          View Full Reply →
        </Button>
      </Section>

      <Hr style={baseStyles.divider} />

      <Text style={baseStyles.muted}>
        You can reply directly in your{" "}
        <a href={url} style={{ color: "#6366f1" }}>
          support dashboard
        </a>
        . Our average response time is under 4 hours.
      </Text>
    </EmailShell>
  )
}

TicketReplyEmail.PreviewProps = {
  name: "Jane Doe",
  ticketId: "ckx1234567890",
  ticketTitle: "Cannot access my dashboard after plan upgrade",
  replySnippet:
    "Hi Jane, thanks for reaching out! We've identified the issue and pushed a fix. Can you try a hard refresh (Ctrl+Shift+R) and let us know if it works?",
  replierName: "Alex (Support Team)",
} satisfies TicketReplyEmailProps

export default TicketReplyEmail
