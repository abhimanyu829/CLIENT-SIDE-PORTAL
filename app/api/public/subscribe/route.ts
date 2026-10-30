import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"
import { resend } from "@/lib/resend"
import { env } from "@/lib/env"

const ADMIN_NOTIFICATION_EMAILS = [
  "luckypal5002@gmail.com",
  "abhimanyuk50281@gmail.com",
]

const subscribeSchema = z.object({
  email: z.string().email("Please provide a valid email address."),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = subscribeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid email" },
        { status: 400 }
      )
    }

    const { email } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()
    const submittedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })

    // 1. Check or create Lead record in database
    try {
      const existingLead = await db.lead.findFirst({
        where: { email: normalizedEmail },
      })

      if (!existingLead) {
        await db.lead.create({
          data: {
            email: normalizedEmail,
            source: "WEBSITE_FOOTER_NEWSLETTER",
            stage: "NEW",
            notes: `Subscribed via Abhibhi Developers Website Footer at ${submittedAt}`,
          },
        })
      }
    } catch (dbErr) {
      console.warn("[SUBSCRIBE-DB-LEAD] DB notice:", dbErr)
    }

    // 2. Dispatch notifications via Resend
    if (resend) {
      const fromEmail = env.EMAIL_FROM || "Abhibhi Developers <onboarding@resend.dev>"

      // A. Send notification to luckypal5002@gmail.com
      for (const adminEmail of ADMIN_NOTIFICATION_EMAILS) {
        try {
          const adminResult = await resend.emails.send({
            from: fromEmail,
            to: adminEmail,
            subject: `🎉 New Newsletter Subscriber: ${normalizedEmail}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; overflow: hidden; padding: 24px; color: #18181b;">
                <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; border-radius: 10px; color: #ffffff; text-align: center; margin-bottom: 20px;">
                  <h2 style="margin: 0; font-size: 20px; font-weight: 800;">🎉 New Newsletter Subscriber!</h2>
                  <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">Abhibhi Developers Website Footer</p>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; color: #71717a; width: 35%;">Subscriber Email:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; font-weight: 700; color: #ea580c;">
                      <a href="mailto:${normalizedEmail}" style="color: #ea580c; text-decoration: none;">${normalizedEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; color: #71717a;">Subscribed At:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; color: #09090b;">${submittedAt} IST</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; color: #71717a;">Source:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; color: #09090b;">Global Website Footer Form</td>
                  </tr>
                </table>

                <div style="margin-top: 24px; text-align: center;">
                  <a href="mailto:${normalizedEmail}?subject=Welcome%20to%20Abhibhi%20Developers!" style="display: inline-block; background: #ea580c; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: bold;">
                    Send Email to ${normalizedEmail}
                  </a>
                </div>

                <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #f4f4f5; font-size: 11px; color: #a1a1aa; text-align: center;">
                  Automatically delivered to luckypal5002@gmail.com from Abhibhi Developers Portal.
                </div>
              </div>
            `,
            reply_to: normalizedEmail,
          })
          console.log(`[SUBSCRIBE-NOTIFICATION] ✅ Admin notified (${adminEmail}) - Resend ID: ${adminResult.data?.id}`)
        } catch (adminErr) {
          console.error(`[SUBSCRIBE-NOTIFICATION] ❌ Failed to notify admin ${adminEmail}:`, adminErr)
        }
      }

      // B. Send Welcome Confirmation email to subscriber
      try {
        await resend.emails.send({
          from: fromEmail,
          to: normalizedEmail,
          subject: "Welcome to Abhibhi Developers! 🎉",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; color: #18181b;">
              <h2 style="color: #ea580c; margin-top: 0;">You're on the list! 🎉</h2>
              <p style="color: #3f3f46; font-size: 14px; line-height: 1.6;">
                Thank you for subscribing to <strong>Abhibhi Developers</strong>. You'll now receive our latest software releases, AI agent updates, architectural insights, and special announcements directly in your inbox.
              </p>
              <div style="margin: 20px 0; padding: 14px; background: #fff7ed; border-radius: 8px; border: 1px solid #ffedd5; font-size: 13px; color: #9a3412;">
                <strong>What to expect:</strong> High-impact engineering articles, SaaS updates, and early access previews. Zero spam, ever.
              </div>
              <p style="font-size: 13px; color: #71717a; margin-top: 24px;">
                Warm regards,<br />
                <strong>Abhibhi Developers Team</strong><br />
                <a href="https://www.abhibhideveloper.tech" style="color: #ea580c;">www.abhibhideveloper.tech</a>
              </p>
            </div>
          `,
        })
        console.log(`[SUBSCRIBE-CONFIRMATION] ✅ Subscriber welcome sent: ${normalizedEmail}`)
      } catch (subErr) {
        console.warn(`[SUBSCRIBE-CONFIRMATION] Subscriber email note:`, subErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Successfully subscribed! Confirmation has been sent.",
    })
  } catch (error: any) {
    console.error("[SUBSCRIBE-ERROR]", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to subscribe" },
      { status: 500 }
    )
  }
}
