import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nexusai.com"
const BRAND_COLOR = "#6366f1" // indigo-500
const SECONDARY_COLOR = "#f1f5f9"
const TEXT_DARK = "#0f172a"
const TEXT_MUTED = "#64748b"

// ── Shared style tokens ──────────────────────────────────────────────────────

export const baseStyles = {
  body: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif",
    backgroundColor: "#f1f5f9",
    margin: 0,
    padding: "32px 0",
  } as React.CSSProperties,

  outer: {
    backgroundColor: "#f1f5f9",
    width: "100%",
  } as React.CSSProperties,

  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    maxWidth: "580px",
    margin: "0 auto",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  } as React.CSSProperties,

  header: {
    backgroundColor: BRAND_COLOR,
    padding: "28px 40px",
    textAlign: "center" as const,
  },

  headerLogo: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: "-0.5px",
    margin: 0,
  } as React.CSSProperties,

  headerTagline: {
    color: "rgba(255,255,255,0.75)",
    fontSize: "13px",
    margin: "4px 0 0",
  } as React.CSSProperties,

  body_inner: {
    padding: "36px 40px",
  } as React.CSSProperties,

  greeting: {
    fontSize: "20px",
    fontWeight: "600",
    color: TEXT_DARK,
    margin: "0 0 12px",
  } as React.CSSProperties,

  paragraph: {
    fontSize: "15px",
    lineHeight: "1.6",
    color: TEXT_DARK,
    margin: "0 0 16px",
  } as React.CSSProperties,

  muted: {
    fontSize: "13px",
    color: TEXT_MUTED,
    lineHeight: "1.5",
    margin: "0 0 12px",
  } as React.CSSProperties,

  divider: {
    borderTop: "1px solid #e2e8f0",
    margin: "28px 0",
  } as React.CSSProperties,

  button: {
    backgroundColor: BRAND_COLOR,
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600",
    padding: "13px 28px",
    textDecoration: "none",
    display: "inline-block",
    marginTop: "8px",
  } as React.CSSProperties,

  buttonDanger: {
    backgroundColor: "#ef4444",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600",
    padding: "13px 28px",
    textDecoration: "none",
    display: "inline-block",
    marginTop: "8px",
  } as React.CSSProperties,

  infoBox: {
    backgroundColor: SECONDARY_COLOR,
    borderRadius: "8px",
    padding: "16px 20px",
    margin: "20px 0",
  } as React.CSSProperties,

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    color: TEXT_DARK,
    margin: "4px 0",
  } as React.CSSProperties,

  infoLabel: {
    color: TEXT_MUTED,
    fontSize: "13px",
  } as React.CSSProperties,

  infoValue: {
    fontWeight: "600",
    fontSize: "13px",
  } as React.CSSProperties,

  footer: {
    padding: "20px 40px 28px",
    textAlign: "center" as const,
    backgroundColor: "#f8fafc",
    borderTop: "1px solid #e2e8f0",
  },

  footerText: {
    fontSize: "12px",
    color: TEXT_MUTED,
    margin: "0 0 6px",
    lineHeight: "1.5",
  } as React.CSSProperties,

  footerLink: {
    color: BRAND_COLOR,
    textDecoration: "none",
    fontSize: "12px",
  } as React.CSSProperties,
}

// ── Shared email shell ───────────────────────────────────────────────────────

interface EmailShellProps {
  preview: string
  children: React.ReactNode
  footerNote?: React.ReactNode
  brandName?: string
  brandTagline?: string
  unsubscribeUrl?: string
}

export function EmailShell({
  preview,
  children,
  footerNote,
  brandName = "NexusAI",
  brandTagline = "Enterprise AI Infrastructure",
  unsubscribeUrl = `${BASE_URL}/settings/notifications`,
}: EmailShellProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={baseStyles.body}>
        <Container style={baseStyles.card}>
          {/* Header / Logo */}
          <Section style={baseStyles.header}>
            <Text style={baseStyles.headerLogo}>{brandName}</Text>
            <Text style={baseStyles.headerTagline}>{brandTagline}</Text>
          </Section>

          {/* Content */}
          <Section style={baseStyles.body_inner}>{children}</Section>

          {/* Footer */}
          <Section style={baseStyles.footer}>
            {footerNote && <Text style={baseStyles.muted}>{footerNote}</Text>}
            <Text style={baseStyles.footerText}>
              © {new Date().getFullYear()} NexusAI, Inc. · All rights reserved.
            </Text>
            <Text style={baseStyles.footerText}>
              <Link href={unsubscribeUrl} style={baseStyles.footerLink}>Unsubscribe</Link>
              {" · "}
              <Link href={`${BASE_URL}/legal/privacy`} style={baseStyles.footerLink}>
                Privacy Policy
              </Link>
              {" · "}
              <Link href={`${BASE_URL}/legal/terms`} style={baseStyles.footerLink}>
                Terms of Service
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
