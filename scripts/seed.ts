/**
 * scripts/seed.ts — Development database seeder
 *
 * Run with:  npx ts-node --project tsconfig.json scripts/seed.ts
 * Or via:    npm run db:seed
 *
 * Seeds: admin user, products + tiers, CRM leads, sample tickets
 */

import { PrismaClient, Role } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting database seeding...")

  // ── Admin user ──────────────────────────────────────────────────────────────
  console.log("👤 Upserting admin user...")
  const adminPassword = await hash("Admin@123456", 12)
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin User",
      role: Role.SUPER_ADMIN,
      passwordHash: adminPassword,
      phone: "+1-555-000-0001",
      timezone: "America/New_York",
    },
  })
  console.log(`   ✓ Admin: ${admin.email} (id: ${admin.id})`)

  // ── Staff user ──────────────────────────────────────────────────────────────
  console.log("👤 Upserting staff user...")
  const staffPassword = await hash("Staff@123456", 12)
  const staff = await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: {
      email: "staff@example.com",
      name: "Support Staff",
      role: Role.SUB_ADMIN,
      passwordHash: staffPassword,
      timezone: "America/Chicago",
    },
  })
  console.log(`   ✓ Staff: ${staff.email} (id: ${staff.id})`)

  // ── Client user ─────────────────────────────────────────────────────────────
  console.log("👤 Upserting client user...")
  const clientPassword = await hash("Client@123456", 12)
  const client = await prisma.user.upsert({
    where: { email: "client@example.com" },
    update: {},
    create: {
      email: "client@example.com",
      name: "Jane Client",
      role: Role.CLIENT,
      passwordHash: clientPassword,
      phone: "+1-555-000-0099",
      timezone: "America/Los_Angeles",
    },
  })
  console.log(`   ✓ Client: ${client.email} (id: ${client.id})`)

  // ── Products + Tiers ────────────────────────────────────────────────────────
  console.log("📦 Seeding products and tiers...")

  const starterProduct = await prisma.product.upsert({
    where: { slug: "starter-saas" },
    update: {},
    create: {
      slug: "starter-saas",
      name: "Starter SaaS",
      tagline: "Everything you need to get started.",
      description: "Everything you need to get started with our platform.",
      type: "SERVICE",
      status: "PUBLISHED",
      features: [
        "AI Chatbot (100 messages/mo)",
        "Basic Analytics",
        "5 Support Tickets/mo",
        "Email Support",
        "1 User Seat",
      ],
      techStack: ["Next.js", "Prisma", "PostgreSQL"],
      thumbnailUrl: "https://placehold.co/400x300?text=Starter",
      createdBy: admin.id,
      tiers: {
        create: [
          {
            name: "Monthly",
            price: 29,
            currency: "USD",
            interval: "MONTHLY",
            features: ["AI Chatbot", "Basic Analytics", "5 Tickets"],
            isPopular: false,
          },
          {
            name: "Annual",
            price: 290,
            currency: "USD",
            interval: "YEARLY",
            features: ["AI Chatbot", "Basic Analytics", "5 Tickets", "2 months free"],
            isPopular: false,
          },
        ],
      },
    },
  })
  console.log(`   ✓ Product: ${starterProduct.name} (${starterProduct.slug})`)

  const proProduct = await prisma.product.upsert({
    where: { slug: "pro-saas" },
    update: {},
    create: {
      slug: "pro-saas",
      name: "Pro SaaS",
      tagline: "Advanced features for growing teams.",
      description: "Advanced features for growing teams.",
      type: "AI_AGENT",
      status: "PUBLISHED",
      features: [
        "Unlimited AI Messages",
        "Advanced Analytics + CRM",
        "Unlimited Support Tickets",
        "Priority Support (4h SLA)",
        "10 User Seats",
        "API Access",
        "Custom Domain",
      ],
      techStack: ["Next.js", "Prisma", "OpenAI", "Stripe"],
      thumbnailUrl: "https://placehold.co/400x300?text=Pro",
      createdBy: admin.id,
      tiers: {
        create: [
          {
            name: "Monthly",
            price: 99,
            currency: "USD",
            interval: "MONTHLY",
            features: ["Everything in Starter", "Unlimited AI", "CRM", "API Access"],
            isPopular: true,
          },
          {
            name: "Annual",
            price: 990,
            currency: "USD",
            interval: "YEARLY",
            features: ["Everything in Starter", "Unlimited AI", "CRM", "API Access", "2 months free"],
            isPopular: false,
          },
        ],
      },
    },
  })
  console.log(`   ✓ Product: ${proProduct.name} (${proProduct.slug})`)

  // ── CRM Leads ────────────────────────────────────────────────────────────────
  console.log("🎯 Seeding CRM leads...")
  await prisma.lead.createMany({
    data: [
      {
        name: "Acme Corp",
        email: "contact@acme.com",
        company: "Acme Corporation",
        source: "WEBSITE",
        stage: "NEW",
        score: 72,
        notes: "Interested in Pro plan for 50 seats",
        assignedTo: admin.id,
      },
      {
        name: "Stark Industries",
        email: "tony@starkindustries.com",
        company: "Stark Industries",
        source: "REFERRAL",
        stage: "PROPOSAL",
        score: 91,
        notes: "Enterprise deal — needs custom SSO",
        assignedTo: staff.id,
      },
      {
        name: "Wayne Enterprises",
        email: "bruce@wayneent.com",
        company: "Wayne Enterprises",
        source: "LINKEDIN",
        stage: "NEGOTIATION",
        score: 85,
        notes: "Comparing us with Competitor X",
        assignedTo: admin.id,
      },
      {
        name: "Umbrella Corp",
        email: "sales@umbrella.com",
        company: "Umbrella Corporation",
        source: "COLD_OUTREACH",
        stage: "CONTACTED",
        score: 45,
        notes: "Initial outreach sent",
        assignedTo: staff.id,
      },
    ],
    skipDuplicates: true,
  })
  console.log("   ✓ 4 CRM leads seeded")

  // ── Support Tickets ──────────────────────────────────────────────────────────
  console.log("🎫 Seeding support tickets...")
  const ticket1 = await prisma.ticket.create({
    data: {
      title: "Cannot access dashboard after plan upgrade",
      description:
        "After upgrading from Starter to Pro, my dashboard still shows starter limits. Cache issue?",
      status: "OPEN",
      priority: "HIGH",
      category: "BILLING",
      clientId: client.id,
    },
  })

  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket1.id,
      senderId: client.id,
      content:
        "Hi, I upgraded yesterday and the AI message limit is still showing 100. My invoice shows Pro plan.",
      isInternal: false,
    },
  })

  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket1.id,
      senderId: staff.id,
      content:
        "Hi Jane! Thanks for reaching out. I can see your subscription updated correctly on our end. Can you try clearing your browser cache and hard refreshing (Ctrl+Shift+R)?",
      isInternal: false,
    },
  })

  const ticket2 = await prisma.ticket.create({
    data: {
      title: "API rate limit exceeded unexpectedly",
      description: "Getting 429 errors on /api/ai/chat even though I'm under the documented limit.",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      category: "TECHNICAL",
      clientId: client.id,
      assignedTo: staff.id,
    },
  })

  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket2.id,
      senderId: staff.id,
      content: "Looking into this — checking your usage logs now.",
      isInternal: true,
    },
  })

  console.log(`   ✓ 2 tickets seeded (ids: ${ticket1.id.slice(0, 8)}, ${ticket2.id.slice(0, 8)})`)

  // ── Audit log entries ────────────────────────────────────────────────────────
  console.log("📋 Seeding audit log entries...")
  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        action: "create",
        entity: "Product",
        entityId: starterProduct.id,
        ip: "127.0.0.1",
        afterJson: { name: starterProduct.name, status: "PUBLISHED" },
      },
      {
        userId: admin.id,
        action: "create",
        entity: "Product",
        entityId: proProduct.id,
        ip: "127.0.0.1",
        afterJson: { name: proProduct.name, status: "PUBLISHED" },
      },
      {
        userId: client.id,
        action: "login",
        entity: "User",
        entityId: client.id,
        ip: "203.0.113.45",
        afterJson: { method: "credentials" },
      },
    ],
    skipDuplicates: true,
  })
  console.log("   ✓ 3 audit log entries seeded")

  console.log("\n✅ Seeding completed successfully!")
  console.log("\nTest accounts:")
  console.log("  Admin  → admin@example.com  / Admin@123456")
  console.log("  Staff  → staff@example.com  / Staff@123456")
  console.log("  Client → client@example.com / Client@123456")
}

main()
  .catch((error) => {
    console.error("❌ Seeding failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    console.log("🔌 Database connection closed.")
  })
