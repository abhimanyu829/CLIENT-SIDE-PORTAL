import { NextRequest, NextResponse } from "next/server"
import { resend } from "@/lib/resend"
import { env } from "@/lib/env"
import { db } from "@/lib/db"

const PARTNER_NOTIFICATION_EMAILS = [
  "luckypal5002@gmail.com",
  "abhimanyuk50281@gmail.com",
]

const TRACK_LABELS: Record<string, string> = {
  integrators: "Solution Integrators & AI Agencies (Up to 25% rev-share)",
  technology: "Technology & ISV Partner (Marketplace & Tools)",
  cloud: "Cloud & Infrastructure Host (Private VPC & Helm)",
  affiliates: "Affiliate & Growth Ambassador (15% Lifetime)",
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name,
      email,
      company,
      phone,
      website,
      track,
      message,
    } = body

    if (!name?.trim() || !email?.trim() || !company?.trim()) {
      return NextResponse.json(
        { success: false, error: "Name, business email, and company name are required." },
        { status: 400 }
      )
    }

    const cleanName = name.trim()
    const cleanEmail = email.trim()
    const cleanCompany = company.trim()
    const cleanPhone = (phone || "").trim()
    const cleanWebsite = (website || "").trim()
    const cleanTrackKey = (track || "integrators").toLowerCase()
    const cleanTrackLabel = TRACK_LABELS[cleanTrackKey] || cleanTrackKey
    const cleanMessage = (message || "").trim() || "No additional business overview provided."
    const submittedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })

    // Build professional Gold/Amber branded HTML email for Admin
    const adminHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #faf9f6; margin: 0; padding: 24px; color: #18181b; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e4e4e7; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #b45309, #d97706, #f59e0b); padding: 32px 24px; color: #ffffff; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.95; font-weight: 500; }
    .content { padding: 28px 24px; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 800; padding: 5px 12px; border-radius: 8px; border: 1px solid #fde68a; margin-bottom: 18px; text-transform: uppercase; letter-spacing: 0.05em; }
    .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .table td { padding: 11px 12px; border-bottom: 1px solid #f4f4f5; font-size: 13px; vertical-align: top; }
    .table td.label { font-weight: 700; color: #71717a; width: 34%; }
    .table td.value { color: #09090b; font-weight: 600; }
    .box { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px; margin-top: 20px; font-size: 13px; line-height: 1.6; color: #27272a; white-space: pre-wrap; }
    .actions { text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f4f4f5; }
    .btn { display: inline-block; background: #b45309; color: #ffffff !important; padding: 11px 22px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 800; margin: 4px; box-shadow: 0 2px 6px rgba(180,83,9,0.25); }
    .btn-secondary { display: inline-block; background: #18181b; color: #ffffff !important; padding: 11px 22px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 800; margin: 4px; }
    .footer { padding: 18px 24px; background: #fafafa; border-top: 1px solid #e4e4e7; text-align: center; font-size: 11px; color: #a1a1aa; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤝 New Partner Application</h1>
      <p>Abhibhi Developers Partner Network — Direct Notification</p>
    </div>
    <div class="content">
      <div style="text-align: center;">
        <span class="badge">Track: ${cleanTrackKey.toUpperCase()}</span>
      </div>

      <table class="table">
        <tr>
          <td class="label">Applicant Name:</td>
          <td class="value">${cleanName}</td>
        </tr>
        <tr>
          <td class="label">Company Name:</td>
          <td class="value" style="color: #b45309; font-size: 14px;">${cleanCompany}</td>
        </tr>
        <tr>
          <td class="label">Business Email:</td>
          <td class="value"><a href="mailto:${cleanEmail}" style="color: #b45309; text-decoration: none;">${cleanEmail}</a></td>
        </tr>
        <tr>
          <td class="label">Phone / WhatsApp:</td>
          <td class="value">
            ${cleanPhone ? `<a href="tel:${cleanPhone}" style="color: #09090b;">${cleanPhone}</a> &nbsp;|&nbsp; <a href="https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}" target="_blank" style="color: #16a34a; font-weight: bold; text-decoration: none;">Open WhatsApp →</a>` : '<span style="color: #a1a1aa;">Not provided</span>'}
          </td>
        </tr>
        <tr>
          <td class="label">Company Website:</td>
          <td class="value">
            ${cleanWebsite ? `<a href="${cleanWebsite.startsWith('http') ? cleanWebsite : `https://${cleanWebsite}`}" target="_blank" style="color: #b45309; text-decoration: underline;">${cleanWebsite}</a>` : '<span style="color: #a1a1aa;">Not provided</span>'}
          </td>
        </tr>
        <tr>
          <td class="label">Selected Track:</td>
          <td class="value" style="font-weight: 700; color: #09090b;">${cleanTrackLabel}</td>
        </tr>
        <tr>
          <td class="label">Submission Date:</td>
          <td class="value">${submittedAt} IST</td>
        </tr>
      </table>

      <div style="margin-top: 22px;">
        <strong style="font-size: 13px; color: #09090b;">Business Overview &amp; Client Reach:</strong>
        <div class="box">${cleanMessage}</div>
      </div>

      <div class="actions">
        <a href="mailto:${cleanEmail}?subject=Regarding%20your%20Abhibhi%20Developers%20Partner%20Application%20(${encodeURIComponent(cleanCompany)})" class="btn">
          Reply to ${cleanName}
        </a>
        ${cleanPhone ? `<a href="https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}" target="_blank" class="btn-secondary">Message on WhatsApp</a>` : ""}
      </div>
    </div>
    <div class="footer">
      This notification was automatically delivered to luckypal5002@gmail.com from the Abhibhi Developers Partner Application form (abhibhideveloper.tech/partners).
    </div>
  </div>
</body>
</html>
`

    // Send email to luckypal5002@gmail.com and admin notifications
    const emailFrom = env.EMAIL_FROM || "Abhibhi Developers <onboarding@resend.dev>"
    const emailResults: any[] = []

    if (resend) {
      for (const toEmail of PARTNER_NOTIFICATION_EMAILS) {
        try {
          const result = await resend.emails.send({
            from: emailFrom,
            to: toEmail,
            subject: `🤝 New Partner Application: ${cleanName} from ${cleanCompany} (${cleanTrackKey.toUpperCase()})`,
            html: adminHtml,
            reply_to: cleanEmail,
          })
          console.log(`[PARTNER-APPLICATION] ✅ Email sent to ${toEmail} - Resend ID: ${result.data?.id}`)
          emailResults.push({ to: toEmail, id: result.data?.id })
        } catch (mailErr: any) {
          console.error(`[PARTNER-APPLICATION] ❌ Failed to send to ${toEmail}:`, mailErr)
          emailResults.push({ to: toEmail, error: mailErr?.message || "Failed to send" })
        }
      }

      // Also send an automated acknowledgment receipt to the applicant
      try {
        await resend.emails.send({
          from: emailFrom,
          to: cleanEmail,
          subject: `We have received your Partner Application — Abhibhi Developers`,
          html: `
            <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #18181b;">
              <h2 style="color: #b45309; margin-bottom: 8px;">Hello ${cleanName},</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
                Thank you for applying to the <strong>Abhibhi Developers Partner Network</strong> on behalf of <strong>${cleanCompany}</strong>.
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
                We have received your application for the <strong>${cleanTrackLabel}</strong> program. Our Partner Solutions Director is reviewing your details and will contact you directly within 24 hours to schedule an introductory onboarding discussion.
              </p>
              <div style="margin: 20px 0; padding: 14px; background: #fef3c7; border-radius: 8px; font-size: 13px; color: #92400e;">
                <strong>Next Step:</strong> Our team will review your application and send you a link to our partner onboarding kit and staging developer sandboxes.
              </div>
              <p style="font-size: 13px; color: #71717a; margin-top: 24px;">
                Warm regards,<br />
                <strong>Abhibhi Developers Partner Team</strong><br />
                <a href="https://www.abhibhideveloper.tech" style="color: #b45309;">www.abhibhideveloper.tech</a>
              </p>
            </div>
          `,
        })
        console.log(`[PARTNER-APPLICATION] ✅ Acknowledgment email sent to applicant: ${cleanEmail}`)
      } catch (ackErr) {
        console.warn(`[PARTNER-APPLICATION] Could not send applicant receipt:`, ackErr)
      }
    } else {
      console.warn("[PARTNER-APPLICATION] RESEND_API_KEY not configured. Email skipped.")
    }

    // Attempt to persist as ServiceLead in Database
    try {
      await db.serviceLead.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone || null,
          company: cleanCompany,
          inquiryType: "ENTERPRISE",
          projectRequirements: "Track: " + cleanTrackLabel + "\nWebsite: " + (cleanWebsite || "N/A") + "\nOverview:\n" + cleanMessage,
          notifiedAdmin: true,
        },
      })
    } catch (dbErr) {
      console.warn("[PARTNER-APPLICATION] DB persistence note (serviceLead):", dbErr)
    }

    return NextResponse.json({
      success: true,
      message: "Partner application submitted and notification email dispatched successfully.",
      emailResults,
    })
  } catch (error: any) {
    console.error("[PARTNER-APPLICATION-ERROR]", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process partner application." },
      { status: 500 }
    )
  }
}
