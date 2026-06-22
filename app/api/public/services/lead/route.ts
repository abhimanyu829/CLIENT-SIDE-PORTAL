import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { sendEmail } from "@/lib/resend"
import ServiceLeadAdminEmail from "@/emails/ServiceLeadAdminEmail"
import ServiceLeadUserEmail from "@/emails/ServiceLeadUserEmail"
import * as React from "react"

const submitLeadSchema = z.object({
  servicePageId: z.string().optional(),
  inquiryType: z.enum(["CONTACT", "PROJECT_REQUEST", "CONSULTATION", "ENTERPRISE"]).default("CONTACT"),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  company: z.string().max(100).optional(),
  projectRequirements: z.string().min(10).max(5000),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = submitLeadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const { name, email, phone, company, projectRequirements, servicePageId, inquiryType } = parsed.data

    let serviceTitle: string | null = null
    if (servicePageId) {
      const service = await db.servicePage.findUnique({ where: { id: servicePageId } })
      if (service) serviceTitle = service.title
    }

    const { lead, crmLead } = await db.$transaction(async (tx) => {
      const serviceLead = await tx.serviceLead.create({
        data: {
          name,
          email,
          phone,
          company,
          inquiryType,
          projectRequirements,
          servicePageId: servicePageId || null,
          notifiedAdmin: false,
        },
      })

      const existingCrmLead = await tx.lead.findFirst({
        where: {
          email: email.toLowerCase(),
          source: "SERVICE_PLATFORM",
        },
      })

      const crm = existingCrmLead
        ? await tx.lead.update({
            where: { id: existingCrmLead.id },
            data: {
              name,
              phone,
              company,
              notes: projectRequirements,
              score: { increment: 5 },
              metadata: {
                source: "SERVICE_PLATFORM",
                serviceLeadId: serviceLead.id,
                servicePageId: servicePageId ?? null,
                serviceTitle,
                inquiryType,
                lastInquiryAt: new Date().toISOString(),
              },
            },
          })
        : await tx.lead.create({
            data: {
              email: email.toLowerCase(),
              name,
              phone,
              company,
              source: "SERVICE_PLATFORM",
              stage: "NEW",
              score: 10,
              notes: projectRequirements,
              metadata: {
                source: "SERVICE_PLATFORM",
                serviceLeadId: serviceLead.id,
                servicePageId: servicePageId ?? null,
                serviceTitle,
                inquiryType,
              },
            },
          })

      return { lead: serviceLead, crmLead: crm }
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

    // 1. Send Email to Admin
    const adminEmailResult = await sendEmail({
      to: "luckypal5002@gmail.com",
      subject: `New Service Lead: ${name} ${serviceTitle ? `for ${serviceTitle}` : ""}`,
      react: React.createElement(ServiceLeadAdminEmail, {
        name,
        email,
        phone: phone || null,
        company: company || null,
        projectRequirements,
        servicePageTitle: serviceTitle,
        adminUrl: `${appUrl}/admin/services/leads`,
      }),
      replyTo: email,
    })

    if (!adminEmailResult.error) {
      await db.serviceLead.update({
        where: { id: lead.id },
        data: { notifiedAdmin: true }
      })
    }

    // 2. Send Confirmation to User
    await sendEmail({
      to: email,
      subject: `Thank you for your inquiry - NexusAI`,
      react: React.createElement(ServiceLeadUserEmail, {
        name,
        servicePageTitle: serviceTitle,
      }),
    })

    return NextResponse.json({ success: true, data: { id: lead.id, crmLeadId: crmLead.id } }, { status: 201 })
  } catch (error) {
    logger.error({ error }, "POST /api/public/services/lead")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
