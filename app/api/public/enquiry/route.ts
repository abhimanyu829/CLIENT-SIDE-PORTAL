import { NextRequest, NextResponse } from "next/server"
import { resend } from "@/lib/resend"
import { env } from "@/lib/env"
import { db } from "@/lib/db"

const NOTIFICATION_EMAILS = ["luckypal5002@gmail.com", "abhimanyuk50281@gmail.com"]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name,
      businessName,
      email,
      phone,
      serviceName,
      budget,
      requirements,
      preferredContact,
      isConsultationRequested,
    } = body

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { success: false, error: "Name, email, and phone are required." },
        { status: 400 }
      )
    }

    const cleanService = serviceName || "General Service Enquiry"
    const cleanBudget = budget || "Not specified"
    const cleanRequirements = requirements || "No specific details provided."
    const cleanPhone = phone.replace(/[^0-9+]/g, "")
    const submittedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })

    // Build professional HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e4e4e7; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #e11d48, #db2777); padding: 28px 24px; color: #ffffff; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 24px; }
    .badge { display: inline-block; background: #ffe4e6; color: #be123c; font-size: 12px; font-weight: 700; padding: 4px 10px; rounded-radius: 6px; border-radius: 6px; margin-bottom: 16px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .table td { padding: 10px 12px; border-bottom: 1px solid #f4f4f5; font-size: 13px; vertical-align: top; }
    .table td.label { font-weight: 700; color: #71717a; width: 38%; }
    .table td.value { color: #09090b; font-weight: 600; }
    .box { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 10px; padding: 14px; margin-top: 18px; font-size: 13px; line-height: 1.6; color: #27272a; white-space: pre-wrap; }
    .footer { padding: 16px 24px; background: #fafafa; border-top: 1px solid #e4e4e7; text-align: center; font-size: 11px; color: #a1a1aa; }
    .btn { display: inline-block; background: #09090b; color: #ffffff !important; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: bold; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Project & Consultation Enquiry</h1>
      <p>Abhibhi Developers — Direct Sales Notification</p>
    </div>
    <div class="content">
      ${isConsultationRequested ? '<span class="badge">⭐ Free 15-Min Consultation Requested</span>' : ""}
      
      <table class="table">
        <tr>
          <td class="label">Full Name:</td>
          <td class="value">${name}</td>
        </tr>
        <tr>
          <td class="label">Business Name:</td>
          <td class="value">${businessName || "Individual / Not specified"}</td>
        </tr>
        <tr>
          <td class="label">Email Address:</td>
          <td class="value"><a href="mailto:${email}" style="color: #e11d48; text-decoration: none;">${email}</a></td>
        </tr>
        <tr>
          <td class="label">Phone / WhatsApp:</td>
          <td class="value"><a href="tel:${cleanPhone}" style="color: #09090b;">${phone}</a> &nbsp;|&nbsp; <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" style="color: #16a34a; font-weight: bold; text-decoration: none;">Chat on WhatsApp →</a></td>
        </tr>
        <tr>
          <td class="label">Service Selected:</td>
          <td class="value" style="color: #e11d48;">${cleanService}</td>
        </tr>
        <tr>
          <td class="label">Budget Range:</td>
          <td class="value">${cleanBudget}</td>
        </tr>
        <tr>
          <td class="label">Preferred Contact:</td>
          <td class="value">${preferredContact || "WhatsApp / Phone"}</td>
        </tr>
        <tr>
          <td class="label">Submitted At (IST):</td>
          <td class="value">${submittedAt}</td>
        </tr>
      </table>

      <div style="margin-top: 20px;">
        <strong style="font-size: 13px; color: #09090b;">Project Requirements &amp; Notes:</strong>
        <div class="box">${cleanRequirements}</div>
      </div>

      <div style="text-align: center; margin-top: 20px;">
        <a href="mailto:${email}?subject=Regarding%20your%20inquiry%20for%20${encodeURIComponent(cleanService)}" class="btn">Reply to ${name}</a>
      </div>
    </div>
    <div class="footer">
      This notification was automatically sent from the Abhibhi Developers Pricing Portal to luckypal5002@gmail.com and abhimanyuk50281@gmail.com.
    </div>
  </div>
</body>
</html>
`

    // 1. Send email to both recipients
    const emailFrom = env.EMAIL_FROM || "Abhibhi Developers <onboarding@resend.dev>"
    const emailResults: any[] = []

    if (resend) {
      for (const toEmail of NOTIFICATION_EMAILS) {
        try {
          const result = await resend.emails.send({
            from: emailFrom,
            to: toEmail,
            subject: `🔔 New Enquiry: ${name} (${cleanService})`,
            html: htmlContent,
            reply_to: email,
          })
          emailResults.push({ to: toEmail, id: result.data?.id, error: result.error?.message })
        } catch (mailErr: any) {
          console.error(`[ENQUIRY-EMAIL-ERROR] Failed to send to ${toEmail}:`, mailErr)
          emailResults.push({ to: toEmail, error: mailErr?.message || "Failed to send" })
        }
      }
    } else {
      console.warn("[ENQUIRY-EMAIL] RESEND_API_KEY not configured. Email skipped.")
    }

    // 2. Persist in database as ServiceLead and Lead for Admin portal
    try {
      await db.serviceLead.create({
        data: {
          name,
          email,
          phone,
          company: businessName || null,
          inquiryType: isConsultationRequested ? "CONSULTATION" : "PROJECT_REQUEST",
          projectRequirements: `Service: ${cleanService}\nBudget: ${cleanBudget}\nConsultation: ${isConsultationRequested ? "YES" : "No"}\nPreferred Contact: ${preferredContact || "WhatsApp"}\n\nNotes:\n${cleanRequirements}`,
          notifiedAdmin: true,
        },
      })
    } catch (dbErr) {
      console.error("[ENQUIRY-DB-ERROR] Failed to save lead record:", dbErr)
    }

    return NextResponse.json({
      success: true,
      message: "Enquiry submitted successfully and notification dispatched.",
      emailDelivery: emailResults,
    })
  } catch (error: any) {
    console.error("[ENQUIRY-API-ERROR]", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

