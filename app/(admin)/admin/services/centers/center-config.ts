export type ServiceCenterConfig = {
  slug: string
  title: string
  eyebrow: string
  description: string
  focus: string[]
  capabilities: string[]
  actionLabel: string
}

export const SERVICE_CENTER_CONFIG: Record<string, ServiceCenterConfig> = {
  "saas-solutions": {
    slug: "saas-solutions",
    title: "SaaS Management Center",
    eyebrow: "SaaS vertical",
    description: "Manage CRM, ERP, school, healthcare, banking, inventory, visitor, taxi, marketplace, real estate, news, and ecommerce solutions from a dedicated control plane.",
    focus: ["CRM Systems", "ERP Systems", "School Management", "Hospital Management", "Banking Systems", "Inventory Systems", "Marketplace Platforms"],
    capabilities: ["Plans", "Add-ons", "Screenshots", "Videos", "Demo URLs", "Preview URLs", "Hosting", "Storage", "Database"],
    actionLabel: "Open SaaS center",
  },
  "ai-agents": {
    slug: "ai-agents",
    title: "AI Agent Management Center",
    eyebrow: "Agentic AI vertical",
    description: "Manage chatbots, RAG systems, multi-agent systems, voice agents, and fine-tuned assistants with their own content, plans, and analytics.",
    focus: ["Chatbots", "RAG Systems", "Multi-Agent Systems", "Voice Agents", "Customer Support Agents", "Sales Agents", "HR Agents"],
    capabilities: ["Knowledge base", "Model type", "Context window", "AI credits", "Usage limits", "Training packages", "Deployment packages"],
    actionLabel: "Open AI agent center",
  },
  "ai-model-development": {
    slug: "ai-model-development",
    title: "AI Model Management Center",
    eyebrow: "Model development vertical",
    description: "Track model builds, experiments, deployment packages, and model-specific commercial plans.",
    focus: ["Model training", "Model evaluation", "Deployment packages", "Context controls", "Usage governance"],
    capabilities: ["Training packages", "Hosting type", "Deployment packages", "Credits", "Limit enforcement"],
    actionLabel: "Open model center",
  },
  "automation-solutions": {
    slug: "automation-solutions",
    title: "Automation Management Center",
    eyebrow: "Automation vertical",
    description: "Manage n8n workflows, WhatsApp automation, CRM/email/lead/sales automation, and agentic automation offers.",
    focus: ["n8n Workflows", "WhatsApp Automation", "CRM Automation", "Email Automation", "Lead Automation", "Sales Automation"],
    capabilities: ["Workflow diagram", "Integrations", "Setup cost", "Subscription cost", "Maintenance cost"],
    actionLabel: "Open automation center",
  },
  "website-development": {
    slug: "website-development",
    title: "Website Management Center",
    eyebrow: "Website vertical",
    description: "Manage business websites, portfolio sites, ecommerce sites, landing pages, and corporate templates with rich demo assets.",
    focus: ["Business Websites", "Portfolio Websites", "Ecommerce Websites", "Landing Pages", "Corporate Websites"],
    capabilities: ["Preview URL", "Video showcase", "Screenshots", "Feature list", "Template controls"],
    actionLabel: "Open website center",
  },
  "api-development": {
    slug: "api-development",
    title: "API Management Center",
    eyebrow: "API vertical",
    description: "Manage platform APIs, developer-facing integrations, preview environments, and release documentation.",
    focus: ["Backend APIs", "Integrations", "Developer experience", "Documentation", "SDK support"],
    capabilities: ["Preview links", "Docs", "Versioning", "Analytics", "Lead capture"],
    actionLabel: "Open API center",
  },
  "enterprise-solutions": {
    slug: "enterprise-solutions",
    title: "Enterprise Solutions Center",
    eyebrow: "Enterprise vertical",
    description: "Track governance-heavy custom work, analytics, rollout programs, and enterprise proposals.",
    focus: ["Custom systems", "Analytics programs", "Governance", "Rollouts", "Advisory"],
    capabilities: ["Proposal docs", "Lead workflows", "Service analytics", "Refunds", "Cancellations"],
    actionLabel: "Open enterprise center",
  },
  "cloud-deployment-services": {
    slug: "cloud-deployment-services",
    title: "Cloud Services Center",
    eyebrow: "Cloud vertical",
    description: "Manage deployment, hosting, storage, database, DevOps, and security offerings in one place.",
    focus: ["Hosting", "Storage", "Database", "Deployment", "Security", "DevOps"],
    capabilities: ["Plans", "Add-ons", "Hosting options", "Storage plans", "Database plans"],
    actionLabel: "Open cloud center",
  },
  "ai-consulting": {
    slug: "ai-consulting",
    title: "Consulting Services Center",
    eyebrow: "Consulting vertical",
    description: "Run strategy, architecture, audit, implementation, and advisory engagements through a dedicated management center.",
    focus: ["Strategy", "Architecture", "Audits", "Implementation planning", "Advisory"],
    capabilities: ["Leads", "Requests", "Docs", "Preview links", "Analytics"],
    actionLabel: "Open consulting center",
  },
  "digital-transformation-services": {
    slug: "digital-transformation-services",
    title: "Digital Transformation Center",
    eyebrow: "Transformation vertical",
    description: "Manage transformation programs, modernization packages, and enterprise onboarding flows.",
    focus: ["Modernization", "Transformation", "Adoption", "Process redesign", "Rollout planning"],
    capabilities: ["Proposals", "Plans", "Add-ons", "Analytics", "Lead routing"],
    actionLabel: "Open transformation center",
  },
}

export const SERVICE_CENTER_ORDER = [
  "saas-solutions",
  "ai-agents",
  "ai-model-development",
  "automation-solutions",
  "website-development",
  "api-development",
  "enterprise-solutions",
  "cloud-deployment-services",
  "ai-consulting",
  "digital-transformation-services",
] as const
