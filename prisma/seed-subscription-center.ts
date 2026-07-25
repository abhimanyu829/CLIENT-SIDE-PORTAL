import {
  PrismaClient,
  PlanTier,
  BillingCycle,
  PriceCurrency,
  BenefitType,
  AddonPricingType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Subscription & Billing Center database layer...");

  // ---------------------------------------------------------------------------
  // 1. Service Categories
  // ---------------------------------------------------------------------------
  const categoriesData = [
    {
      slug: "ai-models",
      name: "AI Models & Intelligence",
      description: "Access next-gen LLMs, vision, and voice models for automated workflows.",
      sortOrder: 1,
    },
    {
      slug: "analytics",
      name: "Advanced Analytics & Insights",
      description: "Real-time platform metrics, funnel tracking, and custom conversion reports.",
      sortOrder: 2,
    },
    {
      slug: "storage",
      name: "Cloud Storage & Data Lake",
      description: "Secure, encrypted cloud storage, file processing, and asset CDN.",
      sortOrder: 3,
    },
    {
      slug: "automation",
      name: "Workflow Automation & Integrations",
      description: "Connect third-party apps and execute event-driven automated pipelines.",
      sortOrder: 4,
    },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesData) {
    const createdCat = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
      },
      create: cat,
    });
    categoryMap.set(cat.slug, createdCat.id);
  }
  console.log(`✅ Upserted ${categoriesData.length} Service Categories.`);
  // 2. Subscription Plans & Benefits
  // ---------------------------------------------------------------------------
  const plansData = [
    {
      slug: "plan-free-monthly",
      name: "Free",
      tagline: "Free tier for personal exploration & testing",
      description: "Basic features with 100 monthly credits and community support.",
      tier: PlanTier.FREE,
      billingCycle: BillingCycle.MONTHLY,
      price: 0.00,
      discountPrice: null,
      currency: PriceCurrency.USD,
      trialDays: 0,
      isPopular: false,
      isRecommended: false,
      sortOrder: 0,
      metadata: {
        upgradePath: ["plan-starter-monthly", "plan-pro-monthly", "plan-enterprise-monthly"],
        supportedCurrencies: ["USD", "EUR", "INR"],
      },
      benefits: [
        {
          title: "100 Monthly AI Credits",
          description: "Generates ~10k words or 5 image renders",
          benefitType: BenefitType.LIMIT,
          benefitValue: "100 credits/mo",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 1,
        },
        {
          title: "Community Dashboard",
          description: "Access basic usage reports",
          benefitType: BenefitType.FEATURE,
          benefitValue: "Basic",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 2,
        },
        {
          title: "1 Workspace Seat Included",
          description: "Single user account access",
          benefitType: BenefitType.LIMIT,
          benefitValue: "1 Seat",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 3,
        },
        {
          title: "Community Support",
          description: "Access to community forums & docs",
          benefitType: BenefitType.SUPPORT,
          benefitValue: "Community",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 4,
        },
      ],
    },
    {
      slug: "plan-starter-monthly",
      name: "Starter",
      tagline: "Ideal for individuals & small projects getting started",
      description: "Essential features with 1,000 monthly credits and standard support.",
      tier: PlanTier.STARTER,
      billingCycle: BillingCycle.MONTHLY,
      price: 19.00,
      discountPrice: 15.00,
      currency: PriceCurrency.USD,
      trialDays: 14,
      isPopular: false,
      isRecommended: false,
      sortOrder: 1,
      metadata: {
        upgradePath: ["plan-pro-monthly", "plan-agency-monthly", "plan-enterprise-monthly"],
        supportedCurrencies: ["USD", "EUR", "INR"],
      },
      benefits: [
        {
          title: "1,000 Monthly AI Credits",
          description: "Generates ~100k words or 50 image renders",
          benefitType: BenefitType.LIMIT,
          benefitValue: "1,000 credits/mo",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 1,
        },
        {
          title: "Core Analytics Dashboard",
          description: "Access basic conversion rates and usage graphs",
          benefitType: BenefitType.FEATURE,
          benefitValue: "Basic",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 2,
        },
        {
          title: "1 Workspace Seat Included",
          description: "Single user account access",
          benefitType: BenefitType.LIMIT,
          benefitValue: "1 Seat",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 3,
        },
        {
          title: "Standard Email Support",
          description: "48-hour response window",
          benefitType: BenefitType.SUPPORT,
          benefitValue: "48h SLA",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 4,
        },
      ],
    },
    {
      slug: "plan-pro-monthly",
      name: "Pro",
      tagline: "For growing teams needing higher limits and priority performance",
      description: "50,000 monthly credits, advanced analytics, custom domain, and priority support.",
      tier: PlanTier.PRO,
      billingCycle: BillingCycle.MONTHLY,
      price: 49.00,
      discountPrice: 39.00,
      currency: PriceCurrency.USD,
      trialDays: 14,
      isPopular: true,
      isRecommended: true,
      sortOrder: 2,
      metadata: {
        upgradePath: ["plan-agency-monthly", "plan-enterprise-monthly"],
        supportedCurrencies: ["USD", "EUR", "GBP", "INR"],
      },
      benefits: [
        {
          title: "50,000 Monthly AI Credits",
          description: "Generates ~5M words or 2,500 image renders",
          benefitType: BenefitType.LIMIT,
          benefitValue: "50,000 credits/mo",
          isHighlighted: true,
          isIncluded: true,
          sortOrder: 1,
        },
        {
          title: "Advanced Analytics & Funnel Tracking",
          description: "Full event attribution & custom drill-down filters",
          benefitType: BenefitType.FEATURE,
          benefitValue: "Full Suite",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 2,
        },
        {
          title: "5 Workspace Seats Included",
          description: "Collaborative workspace for up to 5 team members",
          benefitType: BenefitType.LIMIT,
          benefitValue: "5 Seats",
          isHighlighted: true,
          isIncluded: true,
          sortOrder: 3,
        },
        {
          title: "Custom Domain & White Labeling",
          description: "Serve client portals under your custom domain",
          benefitType: BenefitType.INTEGRATION,
          benefitValue: "Included",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 4,
        },
        {
          title: "Priority Support (4h Response)",
          description: "Fast-tracked ticket handling by technical engineers",
          benefitType: BenefitType.SUPPORT,
          benefitValue: "4h SLA",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 5,
        },
      ],
    },
    {
      slug: "plan-agency-monthly",
      name: "Agency",
      tagline: "For agencies & multi-client managers needing scaling infrastructure",
      description: "250,000 monthly credits, 15 team seats, white-label client portals, and dedicated manager.",
      tier: PlanTier.AGENCY,
      billingCycle: BillingCycle.MONTHLY,
      price: 149.00,
      discountPrice: 129.00,
      currency: PriceCurrency.USD,
      trialDays: 14,
      isPopular: false,
      isRecommended: false,
      sortOrder: 3,
      metadata: {
        upgradePath: ["plan-enterprise-monthly"],
        supportedCurrencies: ["USD", "EUR", "GBP", "INR", "CAD", "AUD"],
      },
      benefits: [
        {
          title: "250,000 Monthly AI Credits",
          description: "Unlimited high-frequency automation processing",
          benefitType: BenefitType.LIMIT,
          benefitValue: "250,000 credits/mo",
          isHighlighted: true,
          isIncluded: true,
          sortOrder: 1,
        },
        {
          title: "15 Workspace Seats Included",
          description: "Granular role-based permissions per team seat",
          benefitType: BenefitType.LIMIT,
          benefitValue: "15 Seats",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 2,
        },
        {
          title: "Unlimited White-Label Client Portals",
          description: "Isolated multi-tenant brand hubs for clients",
          benefitType: BenefitType.FEATURE,
          benefitValue: "Unlimited",
          isHighlighted: true,
          isIncluded: true,
          sortOrder: 3,
        },
        {
          title: "Full REST & GraphQL API Access",
          description: "Direct programmatic integration with webhooks",
          benefitType: BenefitType.INTEGRATION,
          benefitValue: "Full API",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 4,
        },
        {
          title: "Dedicated Account Manager",
          description: "1-on-1 strategy calls and onboarding assistance",
          benefitType: BenefitType.SUPPORT,
          benefitValue: "Dedicated",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 5,
        },
      ],
    },
    {
      slug: "plan-enterprise-monthly",
      name: "Enterprise",
      tagline: "Custom scale with SLA guarantee and dedicated VPC infrastructure",
      description: "Custom volume credits, single-tenant deployment, 99.99% uptime SLA, and 24/7 VIP support.",
      tier: PlanTier.ENTERPRISE,
      billingCycle: BillingCycle.MONTHLY,
      price: 199.00,
      discountPrice: 169.00,
      currency: PriceCurrency.USD,
      trialDays: 30,
      isPopular: false,
      isRecommended: false,
      isCustom: true,
      sortOrder: 4,
      metadata: {
        upgradePath: [],
        supportedCurrencies: ["USD", "EUR", "GBP", "INR", "CAD", "AUD"],
      },
      benefits: [
        {
          title: "Unlimited AI & Processing Throughput",
          description: "Zero throttle caps with high throughput queues",
          benefitType: BenefitType.LIMIT,
          benefitValue: "Custom/Unlimited",
          isHighlighted: true,
          isIncluded: true,
          sortOrder: 1,
        },
        {
          title: "Single-Tenant VPC Infrastructure",
          description: "Isolated compute & encrypted database clusters",
          benefitType: BenefitType.FEATURE,
          benefitValue: "Private VPC",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 2,
        },
        {
          title: "Enterprise SSO & SAML 2.0 Integration",
          description: "Okta, Azure AD, and Google Workspace SSO integration",
          benefitType: BenefitType.INTEGRATION,
          benefitValue: "SSO / SAML",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 3,
        },
        {
          title: "24/7 VIP Phone & Dedicated SLA Support",
          description: "15-minute response guarantee with financial SLA credit",
          benefitType: BenefitType.SUPPORT,
          benefitValue: "15m SLA / 24/7",
          isHighlighted: true,
          isIncluded: true,
          sortOrder: 4,
        },
      ],
    },
    {
      slug: "plan-pro-yearly",
      name: "Pro (Annual)",
      tagline: "Save 20% with annual subscription billing",
      description: "50,000 monthly credits, advanced analytics, custom domain, and priority support billed annually.",
      tier: PlanTier.PRO,
      billingCycle: BillingCycle.YEARLY,
      price: 470.00,
      discountPrice: 390.00,
      currency: PriceCurrency.USD,
      trialDays: 14,
      isPopular: false,
      isRecommended: false,
      sortOrder: 5,
      metadata: {
        upgradePath: ["plan-agency-monthly", "plan-enterprise-monthly"],
        annualSavings: "20%",
      },
      benefits: [
        {
          title: "50,000 Monthly AI Credits",
          description: "Billed annually with 20% total savings",
          benefitType: BenefitType.LIMIT,
          benefitValue: "50,000 credits/mo",
          isHighlighted: true,
          isIncluded: true,
          sortOrder: 1,
        },
        {
          title: "5 Workspace Seats Included",
          description: "Collaborative workspace for up to 5 team members",
          benefitType: BenefitType.LIMIT,
          benefitValue: "5 Seats",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 2,
        },
        {
          title: "Custom Domain & Branding",
          description: "Serve client portals under your custom domain",
          benefitType: BenefitType.INTEGRATION,
          benefitValue: "Included",
          isHighlighted: false,
          isIncluded: true,
          sortOrder: 3,
        },
      ],
    },
  ];

  for (const planData of plansData) {
    const { benefits, ...planFields } = planData;
    const plan = await prisma.subscriptionPlan.upsert({
      where: { slug: planFields.slug },
      update: { ...planFields },
      create: { ...planFields },
    });

    // Re-create benefits for this plan cleanly
    await prisma.planBenefit.deleteMany({ where: { planId: plan.id } });
    for (const b of benefits) {
      await prisma.planBenefit.create({
        data: {
          ...b,
          planId: plan.id,
        },
      });
    }
  }
  console.log(`✅ Upserted ${plansData.length} Subscription Plans with Benefits.`);

  // ---------------------------------------------------------------------------
  // 3. Premium Services
  // ---------------------------------------------------------------------------
  const premiumServicesData = [
    {
      slug: "gpt4o-unlimited-engine",
      categorySlug: "ai-models",
      name: "GPT-4o Advanced Inference Engine",
      shortDescription: "High-speed multi-modal AI inference model for heavy workloads.",
      fullDescription: "Unlock low-latency GPT-4o capabilities directly within your custom workflows with zero rate limit throttling.",
      iconUrl: "/icons/ai-engine.svg",
      bannerUrl: "/banners/ai-engine.png",
      basePrice: 35.00,
      currency: PriceCurrency.USD,
      billingCycle: BillingCycle.MONTHLY,
      isFeatured: true,
      sortOrder: 1,
      metadata: { modelVersion: "gpt-4o-2024-08-06", maxTokens: 128000 },
    },
    {
      slug: "realtime-event-streaming",
      categorySlug: "analytics",
      name: "Realtime Event Streaming & Funnel Engine",
      shortDescription: "Sub-second event ingestion and conversion funnel tracking.",
      fullDescription: "Capture customer micro-interactions and stream raw telemetry data directly to your target warehouse or database.",
      iconUrl: "/icons/analytics-stream.svg",
      bannerUrl: "/banners/analytics-stream.png",
      basePrice: 25.00,
      currency: PriceCurrency.USD,
      billingCycle: BillingCycle.MONTHLY,
      isFeatured: true,
      sortOrder: 2,
      metadata: { retentionDays: 90, maxEventsPerSec: 10000 },
    },
    {
      slug: "enterprise-vault-storage",
      categorySlug: "storage",
      name: "Encrypted Enterprise Vault Storage",
      shortDescription: "SOC2 compliant Zero-Knowledge encrypted storage bucket.",
      fullDescription: "Keep client documents, video backups, and sensitive project assets safe with end-to-end AES-256 encryption.",
      iconUrl: "/icons/storage-vault.svg",
      bannerUrl: "/banners/storage-vault.png",
      basePrice: 20.00,
      currency: PriceCurrency.USD,
      billingCycle: BillingCycle.MONTHLY,
      isFeatured: false,
      sortOrder: 3,
      metadata: { encryption: "AES-256-GCM", redundancy: "Multi-region" },
    },
    {
      slug: "webhook-automation-hub",
      categorySlug: "automation",
      name: "Webhook Automation & Pipeline Hub",
      shortDescription: "Connect 500+ SaaS apps with zero-code automation flows.",
      fullDescription: "Automate billing webhooks, client notifications, and CRM syncs effortlessly across custom trigger events.",
      iconUrl: "/icons/automation-hub.svg",
      bannerUrl: "/banners/automation-hub.png",
      basePrice: 15.00,
      currency: PriceCurrency.USD,
      billingCycle: BillingCycle.MONTHLY,
      isFeatured: false,
      sortOrder: 4,
      metadata: { maxTriggersPerMin: 500, maxConnectors: 50 },
    },
  ];

  const premiumServiceMap = new Map<string, string>();
  for (const item of premiumServicesData) {
    const { categorySlug, ...psFields } = item;
    const categoryId = categoryMap.get(categorySlug) || null;

    const createdPs = await prisma.premiumService.upsert({
      where: { slug: psFields.slug },
      update: {
        ...psFields,
        categoryId,
      },
      create: {
        ...psFields,
        categoryId,
      },
    });
    premiumServiceMap.set(psFields.slug, createdPs.id);
  }
  console.log(`✅ Upserted ${premiumServicesData.length} Premium Services.`);

  // ---------------------------------------------------------------------------
  // 4. Addon Services
  // ---------------------------------------------------------------------------
  const addonServicesData = [
    {
      slug: "addon-extra-seat",
      premiumServiceSlug: "gpt4o-unlimited-engine",
      name: "Additional Team Seat",
      description: "Add extra team members to your active workspace subscription with full collaboration access.",
      pricingType: AddonPricingType.PER_UNIT_RECURRING,
      unitName: "Seat",
      unitPrice: 10.00,
      currency: PriceCurrency.USD,
      billingCycle: BillingCycle.MONTHLY,
      maxQuantity: 50,
      isActive: true,
      sortOrder: 1,
    },
    {
      slug: "addon-50gb-storage",
      premiumServiceSlug: "enterprise-vault-storage",
      name: "50 GB High-Performance Storage",
      description: "Expand your cloud data lake by 50 GB high-speed SSD storage.",
      pricingType: AddonPricingType.FLAT_RECURRING,
      unitName: "Block",
      unitPrice: 15.00,
      currency: PriceCurrency.USD,
      billingCycle: BillingCycle.MONTHLY,
      maxQuantity: 20,
      isActive: true,
      sortOrder: 2,
    },
    {
      slug: "addon-vip-support",
      premiumServiceSlug: null,
      name: "VIP Priority Phone & SLA Support",
      description: "Guaranteed 1-hour response SLA and direct phone line to core infrastructure engineers.",
      pricingType: AddonPricingType.FLAT_RECURRING,
      unitName: "Addon",
      unitPrice: 99.00,
      currency: PriceCurrency.USD,
      billingCycle: BillingCycle.MONTHLY,
      maxQuantity: 1,
      isActive: true,
      sortOrder: 3,
    },
    {
      slug: "addon-dedicated-ip",
      premiumServiceSlug: "webhook-automation-hub",
      name: "Dedicated IPv4 Address",
      description: "Dedicated static IP address for high-volume API rate limits and whitelist security.",
      pricingType: AddonPricingType.FLAT_RECURRING,
      unitName: "IP",
      unitPrice: 29.00,
      currency: PriceCurrency.USD,
      billingCycle: BillingCycle.MONTHLY,
      maxQuantity: 5,
      isActive: true,
      sortOrder: 4,
    },
  ];

  for (const addon of addonServicesData) {
    const { premiumServiceSlug, ...addonFields } = addon;
    const premiumServiceId = premiumServiceSlug ? (premiumServiceMap.get(premiumServiceSlug) || null) : null;

    await prisma.addonService.upsert({
      where: { slug: addonFields.slug },
      update: {
        ...addonFields,
        premiumServiceId,
      },
      create: {
        ...addonFields,
        premiumServiceId,
      },
    });
  }
  console.log(`✅ Upserted ${addonServicesData.length} Addon Services.`);

  console.log("🎉 Subscription & Billing Center database layer seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
