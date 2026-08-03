import { Button, Hr, Section, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nexusai.com"

export interface ServiceLifecycleEmailProps {
  name: string
  serviceName: string
  addonName?: string
  reason?: string
  daysLeft?: number
  expiryDate?: string
  workspaceUrl?: string
}

interface Variant {
  preview: (p: ServiceLifecycleEmailProps) => string
  heading: string
  body: (p: ServiceLifecycleEmailProps) => React.ReactNode
  cta: string
  footer: string
}

const workspace = (p: ServiceLifecycleEmailProps) => p.workspaceUrl ?? `${BASE_URL}/dashboard/services`

const ServiceLifecycleEmail = ({ variant, props }: { variant: Variant; props: ServiceLifecycleEmailProps }) => (
  <EmailShell preview={variant.preview(props)} footerNote={variant.footer}>
    <Text style={baseStyles.greeting}>{variant.heading}</Text>
    <Text style={baseStyles.paragraph}>Hi {props.name},</Text>
    <Text style={baseStyles.paragraph}>{variant.body(props)}</Text>
    <Section style={baseStyles.infoBox}>
      {[
        ["Service", props.serviceName],
        ...(props.addonName ? [["Add-on", props.addonName] as [string, string]] : []),
        ...(props.expiryDate ? [["Expiry date", props.expiryDate] as [string, string]] : []),
        ...(props.reason ? [["Reason", props.reason] as [string, string]] : []),
      ].map(([label, value]) => (
        <Section key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
          <Text style={{ ...baseStyles.infoLabel, margin: 0, display: "inline" }}>{label}</Text>
          <Text style={{ ...baseStyles.infoValue, margin: 0, display: "inline" }}>{value}</Text>
        </Section>
      ))}
    </Section>
    <Section style={{ textAlign: "center" as const, margin: "28px 0 8px" }}>
      <Button href={workspace(props)} style={baseStyles.button}>
        {variant.cta} →
      </Button>
    </Section>
    <Hr style={baseStyles.divider} />
    <Text style={baseStyles.muted}>Questions about your service? Reply to this email — our team typically responds within 1 business day.</Text>
  </EmailShell>
)

const make = (variant: Variant) => {
  const Component = (props: ServiceLifecycleEmailProps) => <ServiceLifecycleEmail variant={variant} props={props} />
  Component.PreviewProps = { name: "Jane Doe", serviceName: "School Management System", addonName: "Additional Storage", reason: "Subscription expired", daysLeft: 3, expiryDate: "Aug 2, 2026" } satisfies ServiceLifecycleEmailProps
  return Component
}

export const DeploymentStartedEmail = make({
  heading: "Deployment started",
  preview: (p) => `Deployment of ${p.serviceName} has started`,
  body: (p) => <>Great news — our deployment team has started provisioning <strong>{p.serviceName}</strong>. You can follow every step live in your service workspace.</>,
  cta: "Track deployment",
  footer: "You're receiving this because your service deployment just started.",
})
export default DeploymentStartedEmail

export const DeploymentCompletedEmail = make({
  heading: "Deployment completed",
  preview: (p) => `${p.serviceName} is deployed and ready`,
  body: (p) => <><strong>{p.serviceName}</strong> has been deployed successfully. Your credentials and access details are now available in your workspace.</>,
  cta: "View credentials",
  footer: "You're receiving this because your service deployment completed.",
})

export const ServiceActivatedEmail = make({
  heading: "Service activated",
  preview: (p) => `${p.serviceName} is now active`,
  body: (p) => <><strong>{p.serviceName}</strong> is now active. Sign in from your workspace to start using it.</>,
  cta: "Open workspace",
  footer: "You're receiving this because your service was activated.",
})

export const UpgradePurchasedEmail = make({
  heading: "Upgrade purchased",
  preview: (p) => `Upgrade ${p.addonName ?? ""} purchased for ${p.serviceName}`,
  body: (p) => <>We received your upgrade <strong>{p.addonName}</strong> for <strong>{p.serviceName}</strong>. Our team will apply it to your workspace shortly.</>,
  cta: "View upgrades",
  footer: "You're receiving this because you purchased an upgrade.",
})

export const UpgradeAppliedEmail = make({
  heading: "Upgrade applied",
  preview: (p) => `${p.addonName ?? "Your upgrade"} is now active on ${p.serviceName}`,
  body: (p) => <><strong>{p.addonName}</strong> is now active on <strong>{p.serviceName}</strong>. New limits and features are live in your workspace.</>,
  cta: "See what's new",
  footer: "You're receiving this because an upgrade was applied to your service.",
})

export const ServiceSuspendedEmail = make({
  heading: "Service suspended",
  preview: (p) => `${p.serviceName} has been suspended`,
  body: (p) => <><strong>{p.serviceName}</strong> has been suspended{p.reason ? <> — {p.reason}</> : null}. Your data is safe and nothing was deleted. Renew or contact support to restore access.</>,
  cta: "Restore access",
  footer: "You're receiving this because your service was suspended.",
})

export const ServiceReactivatedEmail = make({
  heading: "Service reactivated",
  preview: (p) => `${p.serviceName} is active again`,
  body: (p) => <><strong>{p.serviceName}</strong> is active again. All URLs and credentials are working as before.</>,
  cta: "Open workspace",
  footer: "You're receiving this because your service was reactivated.",
})

export const RenewalReminderEmail = make({
  heading: "Subscription expiring soon",
  preview: (p) => `${p.serviceName} expires in ${p.daysLeft ?? "a few"} day(s)`,
  body: (p) => <>Your <strong>{p.serviceName}</strong> subscription expires in <strong>{p.daysLeft} day(s)</strong>{p.expiryDate ? <> (on {p.expiryDate})</> : null}. Renew now to keep your service running without interruption.</>,
  cta: "Renew now",
  footer: "You're receiving this reminder because your subscription is about to expire.",
})
