import { Section, Text } from "@react-email/components"
import * as React from "react"
import { EmailShell, baseStyles } from "./_shared"

interface ServiceLeadAdminEmailProps {
  name: string
  email: string
  phone: string | null
  company: string | null
  projectRequirements: string
  servicePageTitle: string | null
  adminUrl: string
}

export default function ServiceLeadAdminEmail({
  name,
  email,
  phone,
  company,
  projectRequirements,
  servicePageTitle,
  adminUrl,
}: ServiceLeadAdminEmailProps) {
  const serviceName = servicePageTitle ? `for ${servicePageTitle}` : "from a Service Page"
  
  return (
    <EmailShell preview={`New Service Lead: ${name}`}>
      <Text style={baseStyles.greeting}>New Service Lead Received</Text>
      <Text style={baseStyles.paragraph}>
        You have received a new service inquiry {serviceName}.
      </Text>

      <Section style={baseStyles.infoBox}>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Name:</span>
          <span style={baseStyles.infoValue}>{name}</span>
        </div>
        <div style={baseStyles.infoRow}>
          <span style={baseStyles.infoLabel}>Email:</span>
          <span style={baseStyles.infoValue}>{email}</span>
        </div>
        {phone && (
          <div style={baseStyles.infoRow}>
            <span style={baseStyles.infoLabel}>Phone:</span>
            <span style={baseStyles.infoValue}>{phone}</span>
          </div>
        )}
        {company && (
          <div style={baseStyles.infoRow}>
            <span style={baseStyles.infoLabel}>Company:</span>
            <span style={baseStyles.infoValue}>{company}</span>
          </div>
        )}
        <div style={{ ...baseStyles.infoRow, marginTop: "12px", display: "block" }}>
          <span style={baseStyles.infoLabel}>Requirements:</span>
          <div style={{ ...baseStyles.infoValue, marginTop: "4px", whiteSpace: "pre-wrap" }}>
            {projectRequirements}
          </div>
        </div>
      </Section>

      <Section style={{ textAlign: "center", marginTop: "24px" }}>
        <a href={adminUrl} style={baseStyles.button}>
          View in Admin Panel
        </a>
      </Section>
    </EmailShell>
  )
}
