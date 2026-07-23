import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { CUSTOM_SERVICE_PORTAL_ID, getCustomServicePortalSetting, isCustomServiceAdmin } from "@/lib/custom-service-portal"

const schema = z.object({ isEnabled: z.boolean(), publicPath: z.enum(["/request-service", "/custom-service"]) })

async function admin() { const session = await auth(); if (!session?.user?.id || !(await isCustomServiceAdmin(session.user.id))) throw new Error("FORBIDDEN"); return session.user }

export async function GET() { try { await admin(); return NextResponse.json({ success: true, data: await getCustomServicePortalSetting() }) } catch { return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) } }
export async function PATCH(request: NextRequest) { try { const user = await admin(); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid portal configuration" }, { status: 422 }); const setting = await db.customServicePortalSetting.upsert({ where: { id: CUSTOM_SERVICE_PORTAL_ID }, create: { id: CUSTOM_SERVICE_PORTAL_ID, ...parsed.data, updatedById: user.id }, update: { ...parsed.data, updatedById: user.id } }); return NextResponse.json({ success: true, data: setting }) } catch { return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) } }
