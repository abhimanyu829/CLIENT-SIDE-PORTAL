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
      status: ProductStatus.AVAILABLE,
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
      status: ProductStatus.AVAILABLE,
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
      status: ProductStatus.AVAILABLE,
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

  const serviceCategories = [
    { slug: "saas-solutions", name: "SaaS Solutions", description: "Enterprise SaaS product builds and platform delivery.", sortOrder: 1 },
    { slug: "ai-agents", name: "AI Agents", description: "Autonomous assistants, copilots, and workflow agents.", sortOrder: 2 },
    { slug: "ai-model-development", name: "AI Model Development", description: "Model training, fine-tuning, and evaluation.", sortOrder: 3 },
    { slug: "agentic-ai-systems", name: "Agentic AI Systems", description: "Multi-agent orchestration and automation layers.", sortOrder: 4 },
    { slug: "automation-solutions", name: "Automation Solutions", description: "Workflow automation, process orchestration, and integration.", sortOrder: 5 },
    { slug: "website-development", name: "Website Development", description: "High-end websites, landing pages, and brand experiences.", sortOrder: 6 },
    { slug: "api-development", name: "API Development", description: "Backend APIs, integrations, and developer platforms.", sortOrder: 7 },
    { slug: "enterprise-solutions", name: "Enterprise Solutions", description: "Complex internal systems for scale and governance.", sortOrder: 8 },
    { slug: "cloud-deployment-services", name: "Cloud Deployment Services", description: "Infrastructure, hosting, and release engineering.", sortOrder: 9 },
    { slug: "ai-consulting", name: "AI Consulting", description: "Discovery, architecture, and strategic AI advisory.", sortOrder: 10 },
    { slug: "digital-transformation-services", name: "Digital Transformation Services", description: "End-to-end modernization and automation programs.", sortOrder: 11 },
  ]

  for (const category of serviceCategories) {
    await prisma.serviceCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: category,
    })
  }

  // Create Permissions
  const permissions = [
    { name: 'manage:users', action: 'manage', resource: 'users' },
    { name: 'manage:products', action: 'manage', resource: 'products' },
    { name: 'manage:billing', action: 'manage', resource: 'billing' },
    { name: 'view:dashboard', action: 'view', resource: 'dashboard' },
    { name: 'manage:service:emails', action: 'manage', resource: 'service_emails' },
    { name: 'manage:service:analytics', action: 'manage', resource: 'service_analytics' },
    { name: 'manage:service:orders', action: 'manage', resource: 'service_orders' },
    { name: 'manage:service:requests', action: 'manage', resource: 'service_requests' },
    { name: 'manage:service-center:saas-solutions', action: 'manage', resource: 'service_center_saas_solutions' },
    { name: 'manage:service-center:ai-agents', action: 'manage', resource: 'service_center_ai_agents' },
    { name: 'manage:service-center:ai-model-development', action: 'manage', resource: 'service_center_ai_model_development' },
    { name: 'manage:service-center:automation-solutions', action: 'manage', resource: 'service_center_automation_solutions' },
    { name: 'manage:service-center:website-development', action: 'manage', resource: 'service_center_website_development' },
    { name: 'manage:service-center:api-development', action: 'manage', resource: 'service_center_api_development' },
    { name: 'manage:service-center:enterprise-solutions', action: 'manage', resource: 'service_center_enterprise_solutions' },
    { name: 'manage:service-center:cloud-deployment-services', action: 'manage', resource: 'service_center_cloud_deployment_services' },
    { name: 'manage:service-center:ai-consulting', action: 'manage', resource: 'service_center_ai_consulting' },
    { name: 'manage:service-center:digital-transformation-services', action: 'manage', resource: 'service_center_digital_transformation_services' },
  ]
  await prisma.permission.createMany({ data: permissions, skipDuplicates: true })

  const servicePermissionNames = permissions.map((permission) => permission.name)
  const permissionRows = await prisma.permission.findMany({
    where: { name: { in: servicePermissionNames } },
    select: { id: true, name: true },
  })
  const permissionByName = new Map(permissionRows.map((permission) => [permission.name, permission.id]))

  const userByEmail = async (email: string) =>
    prisma.user.findUnique({ where: { email }, select: { id: true } })

  const techAdmin = await userByEmail('tech@platform.com')
  const marketingAdmin = await userByEmail('marketing@platform.com')
  const financeAdmin = await userByEmail('finance@platform.com')

  const grants = [
    ...(techAdmin ? [
      'manage:service-center:saas-solutions',
      'manage:service-center:ai-model-development',
      'manage:service-center:api-development',
      'manage:service-center:cloud-deployment-services',
    ].map((name) => ({ userId: techAdmin.id, permissionId: permissionByName.get(name)!, grantedBy: superAdmin.id })) : []),
    ...(marketingAdmin ? [
      'manage:service-center:ai-agents',
      'manage:service-center:automation-solutions',
      'manage:service-center:website-development',
      'manage:service-center:ai-consulting',
      'manage:service-center:digital-transformation-services',
    ].map((name) => ({ userId: marketingAdmin.id, permissionId: permissionByName.get(name)!, grantedBy: superAdmin.id })) : []),
    ...(financeAdmin ? [
      'manage:service:emails',
      'manage:service:analytics',
      'manage:service:orders',
      'manage:service:requests',
      'manage:service-center:enterprise-solutions',
    ].map((name) => ({ userId: financeAdmin.id, permissionId: permissionByName.get(name)!, grantedBy: superAdmin.id })) : []),
  ].filter((grant) => !!grant.permissionId)

  await prisma.userPermission.createMany({ data: grants, skipDuplicates: true })

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
