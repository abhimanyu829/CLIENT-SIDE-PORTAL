import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth"
import { db as prisma } from "@/lib/db";
import Papa from "papaparse";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;
    
    if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json({ error: "Invalid CSV format", details: parseResult.errors }, { status: 400 });
    }

    const rows = parseResult.data as any[];
    
    const existingLeads = await prisma.lead.findMany({
      select: { email: true }
    });
    const existingEmails = new Set(existingLeads.map((l: any) => l.email));

    const validLeads: any[] = [];
    let skippedCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      if (!row.email || typeof row.email !== 'string' || row.email.trim() === '') {
        errorCount++;
        continue;
      }

      const email = row.email.trim();

      if (existingEmails.has(email)) {
        skippedCount++;
        continue;
      }

      validLeads.push({
        email,
        name: row.name || null,
        phone: row.phone || null,
        company: row.company || null,
        source: row.source || "CSV_IMPORT",
        stage: row.stage || "NEW",
        score: parseInt(row.score) || 0,
        notes: row.notes || null,
      });

      existingEmails.add(email);
    }

    if (validLeads.length > 0) {
      await prisma.lead.createMany({
        data: validLeads,
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        imported: validLeads.length,
        skipped: skippedCount,
        errors: errorCount,
        total: rows.length
      }
    });

  } catch (error) {
    console.error("CSV Import Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
