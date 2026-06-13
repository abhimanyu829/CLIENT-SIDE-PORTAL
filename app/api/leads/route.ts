import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/leads — list CRM leads (admin only)
export async function GET(req: Request) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const stage = searchParams.get("stage") ?? undefined
    const search = searchParams.get("q") ?? undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"))
    const skip = (page - 1) * limit

    const where = {
      ...(stage ? { stage: stage as any } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
              { company: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        orderBy: { score: "desc" },
        skip,
        take: limit,
        include: {
          assignee: { select: { name: true, avatarUrl: true } },
          interactions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      db.lead.count({ where }),
    ])

    return NextResponse.json({
      data: leads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("[leads] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


// STAGE WEIGHTS FOR LEAD SCORING
const STAGE_WEIGHTS: Record<string, number> = {
  NEW: 10,
  CONTACTED: 20,
  PROPOSAL: 40,
  NEGOTIATION: 60,
  WON: 100,
  LOST: 0,
};

function calculateLeadScore(stage: string, createdAt: Date, dealSize: number = 0): number {
  const stageWeight = STAGE_WEIGHTS[stage] || 0;
  
  const daysSinceContact = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const recencyPenalty = Math.max(0, daysSinceContact * 2);
  const dealSizeBonus = Math.floor(dealSize / 10000) * 10;
  
  return Math.max(0, stageWeight - recencyPenalty + dealSizeBonus);
}

// POST /api/leads — create a new CRM lead
export async function POST(req: Request) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    
    const body = await req.json()
    const { email, name, phone, company, source, stage, score, assignedTo, notes, dealSize } = body

    if (!email || !source) {
      return NextResponse.json({ error: "email and source are required" }, { status: 400 })
    }

    if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN" && source !== "demo") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const initialStage = stage ?? "NEW";
    const calculatedScore = calculateLeadScore(initialStage, new Date(), dealSize || 0);

    const lead = await db.lead.create({
      data: {
        email,
        name,
        phone,
        company,
        source,
        stage: initialStage,
        score: score ?? calculatedScore,
        assignedTo,
        notes,
        metadata: dealSize ? { dealSize } : undefined
      },
    })

    if (session?.user?.id) {
        await db.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "STAGE_CHANGE",
            note: `Lead created in stage: ${initialStage}`,
            createdBy: session.user.id
          }
        });
    }

    return NextResponse.json({ data: lead }, { status: 201 })
  } catch (err) {
    console.error("[leads] POST:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id, stage, dealSize, note } = await req.json()

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const existingLead = await db.lead.findUnique({ where: { id } });
    if (!existingLead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const newStage = stage || existingLead.stage;
    
    const existingMetadata = existingLead.metadata as any;
    const currentDealSize = existingMetadata?.dealSize || 0;
    const newDealSize = dealSize !== undefined ? dealSize : currentDealSize;

    const newScore = calculateLeadScore(newStage, existingLead.createdAt, newDealSize);

    const lead = await db.lead.update({
      where: { id },
      data: { 
        stage: newStage,
        score: newScore,
        ...(dealSize !== undefined ? { metadata: { ...existingMetadata, dealSize } } : {})
      }
    });

    if (session?.user?.id) {
      if (stage && stage !== existingLead.stage) {
        await db.leadActivity.create({
          data: {
            leadId: id,
            type: "STAGE_CHANGE",
            note: `Stage changed from ${existingLead.stage} to ${stage}`,
            createdBy: session.user.id
          }
        });
      }

      if (note) {
        await db.leadActivity.create({
          data: {
            leadId: id,
            type: "NOTE",
            note: note,
            createdBy: session.user.id
          }
        });
      }
    }

    return NextResponse.json({ data: lead });

  } catch (err) {
    console.error("[leads] PATCH:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
