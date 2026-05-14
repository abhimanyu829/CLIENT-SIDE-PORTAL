import { PrismaClient, Role, Department, ProductType, ProductStatus, BillingInterval, LeadStage } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding ...')

  const password = await hash('Admin@123456', 12)

  // Create Users
  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@platform.com',
      name: 'Super Admin',
      passwordHash: password,
      role: Role.SUPER_ADMIN,
      isVerified: true,
    },
  })

  await prisma.user.create({
    data: {
      email: 'tech@platform.com',
      name: 'Tech Admin',
      passwordHash: password,
      role: Role.SUB_ADMIN,
      department: Department.TECH,
      isVerified: true,
    },
  })

  await prisma.user.create({
    data: {
      email: 'marketing@platform.com',
      name: 'Marketing Admin',
      passwordHash: password,
      role: Role.SUB_ADMIN,
      department: Department.MARKETING,
      isVerified: true,
    },
  })

  await prisma.user.create({
    data: {
      email: 'finance@platform.com',
      name: 'Finance Admin',
      passwordHash: password,
      role: Role.SUB_ADMIN,
      department: Department.FINANCE,
      isVerified: true,
    },
  })

  await prisma.user.create({
    data: {
      email: 'client1@test.com',
      name: 'Test Client 1',
      passwordHash: await hash('Client@123', 12),
      role: Role.CLIENT,
      isVerified: true,
    },
  })

  await prisma.user.create({
    data: {
      email: 'client2@test.com',
      name: 'Test Client 2',
      passwordHash: await hash('Client@123', 12),
      role: Role.CLIENT,
      isVerified: true,
    },
  })

  // Create Products and Tiers
  // Note: Product.features is Json (required) — must be a valid JSON value
  await prisma.product.create({
    data: {
      slug: 'awesome-saas',
      name: 'Awesome SaaS',
      tagline: 'The best SaaS for being awesome.',
      description: 'A very detailed description of why this SaaS is so awesome.',
      type: ProductType.SAAS,
      status: ProductStatus.PUBLISHED,
      features: ['Feature A', 'Feature B', 'Feature C'],
      createdBy: superAdmin.id,
      tiers: {
        create: [
          { name: 'Basic', price: 10, interval: BillingInterval.MONTHLY, features: ['Feature A', 'Feature B'] },
          { name: 'Pro', price: 25, interval: BillingInterval.MONTHLY, features: ['Feature A', 'Feature B', 'Feature C'], isPopular: true },
          { name: 'Enterprise', price: 250, interval: BillingInterval.YEARLY, features: ['All Features', 'Support'] },
        ]
      }
    }
  })

  await prisma.product.create({
    data: {
      slug: 'cool-service',
      name: 'Cool Service',
      tagline: 'A service that is very cool.',
      description: 'A detailed description of this very cool service.',
      type: ProductType.SERVICE,
      status: ProductStatus.PUBLISHED,
      features: ['Consultation', 'Implementation'],
      createdBy: superAdmin.id,
      tiers: {
        create: [
          { name: 'Starter', price: 50, interval: BillingInterval.ONE_TIME, features: ['Consultation'] },
          { name: 'Growth', price: 150, interval: BillingInterval.ONE_TIME, features: ['Consultation', 'Implementation'] },
        ]
      }
    }
  })

  await prisma.product.create({
    data: {
      slug: 'smart-ai-agent',
      name: 'Smart AI Agent',
      tagline: 'An AI that is very smart.',
      description: 'A detailed description of this very smart AI agent.',
      type: ProductType.AI_AGENT,
      status: ProductStatus.PUBLISHED,
      features: ['1000 calls/mo', '5000 calls/mo'],
      createdBy: superAdmin.id,
      tiers: {
        create: [
          { name: 'Hobby', price: 5, interval: BillingInterval.MONTHLY, features: ['1000 calls/mo'] },
          { name: 'Developer', price: 20, interval: BillingInterval.MONTHLY, features: ['5000 calls/mo'] },
        ]
      }
    }
  })

  // Create Permissions
  const permissions = [
    { name: 'manage:users', action: 'manage', resource: 'users' },
    { name: 'manage:products', action: 'manage', resource: 'products' },
    { name: 'manage:billing', action: 'manage', resource: 'billing' },
    { name: 'view:dashboard', action: 'view', resource: 'dashboard' },
  ]
  await prisma.permission.createMany({ data: permissions })

  // Create Leads
  const leads = [
    { email: 'lead1@example.com', name: 'Lead One', stage: LeadStage.NEW, source: 'Website' },
    { email: 'lead2@example.com', name: 'Lead Two', stage: LeadStage.CONTACTED, source: 'Referral' },
    { email: 'lead3@example.com', name: 'Lead Three', stage: LeadStage.QUALIFIED, source: 'Social' },
    { email: 'lead4@example.com', name: 'Lead Four', stage: LeadStage.PROPOSAL, source: 'Website' },
    { email: 'lead5@example.com', name: 'Lead Five', stage: LeadStage.NEGOTIATION, source: 'Referral' },
    { email: 'lead6@example.com', name: 'Lead Six', stage: LeadStage.WON, source: 'Social' },
  ]
  await prisma.lead.createMany({ data: leads })

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
