"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Globe2,
  ShoppingCart,
  GraduationCap,
  Plane,
  Stethoscope,
  Building,
  Cpu,
  BarChart2,
  MessageSquare,
  FileText,
  Zap,
  Phone,
  Mail,
  Send,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Check,
} from "lucide-react"

// Types
interface ServiceItem {
  id: string
  name: string
  category: "website" | "saas" | "ai" | "pilot"
  categoryLabel: string
  tagline: string
  advertisedPrice: string
  setupFee: string
  recurringFee: string | null
  badge?: string
  isPopular?: boolean
  description: string
  deliverables: string[]
  exclusions: string[]
  bestFor: string
}

const SERVICES: ServiceItem[] = [
  // ── Category 01: Website & Digital Presence ──────────────────
  {
    id: "starter-website",
    name: "Starter Website",
    category: "website",
    categoryLabel: "Website & Digital Presence",
    tagline: "Essential online presence for local businesses & professionals",
    advertisedPrice: "₹4,999",
    setupFee: "₹4,999 one-time",
    recurringFee: null,
    description: "Responsive 1–3 page website covering Homepage, About, Services, and Contact sections with clear enquiry forms.",
    deliverables: [
      "1–3 responsive pages (Mobile, Tablet, Desktop)",
      "Homepage, About, Services & Contact sections",
      "Click-to-call, WhatsApp CTA & enquiry form",
      "Basic SEO metadata & image optimization",
      "Deployment to client hosting or cloud server",
    ],
    exclusions: ["Domain & hosting registration costs", "Payment gateway integration", "Content copywriting & logo design"],
    bestFor: "Local shops, doctors, solo consultants, freelancers",
  },
  {
    id: "business-website",
    name: "Business Website",
    category: "website",
    categoryLabel: "Website & Digital Presence",
    tagline: "Custom-branded corporate layout with on-page SEO",
    advertisedPrice: "₹9,499",
    setupFee: "₹9,499 one-time",
    recurringFee: null,
    badge: "Popular",
    isPopular: true,
    description: "Up to 5 agreed pages featuring custom brand styling, service showcases, social integration, and Google Analytics setup.",
    deliverables: [
      "Up to 5 custom-designed pages",
      "Full brand styling & mobile-first responsive layout",
      "Service catalogues & team profile showcase",
      "Basic on-page SEO & Google Analytics setup",
      "Cross-browser and cross-device testing",
    ],
    exclusions: ["Third-party API charges", "Complex multi-step booking logic", "Paid domain and hosting"],
    bestFor: "Small-to-medium businesses, clinics, legal firms, agencies",
  },
  {
    id: "ecommerce-website",
    name: "E-commerce Website",
    category: "website",
    categoryLabel: "Website & Digital Presence",
    tagline: "Full-featured online store with payment gateway and cart",
    advertisedPrice: "₹17,999+",
    setupFee: "₹17,999+ one-time",
    recurringFee: null,
    badge: "Full Store",
    description: "Complete product catalog, shopping cart, Razorpay / UPI checkout flow, and basic order management dashboard.",
    deliverables: [
      "Product catalog, categories & product detail pages",
      "Shopping cart & secure checkout interface",
      "Payment gateway integration (Razorpay / UPI / Stripe)",
      "Order status notifications & admin orders view",
      "Mobile-optimized purchase flow and testing",
    ],
    exclusions: ["Payment gateway transaction fees (2%)", "Advanced inventory sync ERPs", "Custom shipping logistics API fees"],
    bestFor: "Retail brands, digital goods, apparel, specialty stores",
  },
  {
    id: "google-business-setup",
    name: "Google Business Profile Setup",
    category: "website",
    categoryLabel: "Website & Digital Presence",
    tagline: "Verified local map presence to capture nearby customers",
    advertisedPrice: "₹1,999",
    setupFee: "₹1,999 one-time",
    recurringFee: null,
    description: "Complete profile creation or optimization, category review, photo uploads, hours setup, and verification assistance.",
    deliverables: [
      "Profile eligibility and ownership verification assistance",
      "Business information, category & hours review",
      "Assistance with service descriptions & contact links",
      "Photo preparation & profile completeness audit",
      "Guidance on capturing authentic customer reviews",
    ],
    exclusions: ["Guaranteed Google ranking / position #1", "Google advertising credits"],
    bestFor: "Retail shops, salons, clinics, restaurants, repair services",
  },
  {
    id: "local-seo-starter",
    name: "Local SEO Starter",
    category: "website",
    categoryLabel: "Website & Digital Presence",
    tagline: "Ongoing local search optimization and ranking improvements",
    advertisedPrice: "₹2,499/mo",
    setupFee: "₹0 setup",
    recurringFee: "₹2,499 / month",
    description: "Monthly baseline visibility review, local-intent keyword research, on-page SEO tweaks, and monthly performance summary.",
    deliverables: [
      "Local keyword & search-intent mapping",
      "On-page meta title and description optimization",
      "Google Business Profile updates & monthly posting recommendations",
      "Monthly search visibility work summary",
    ],
    exclusions: ["Paid Google Ads / PPC budget", "Guaranteed enquiry volumes"],
    bestFor: "Businesses looking to rank above local competitors",
  },
  {
    id: "social-media-starter",
    name: "Social Media Starter",
    category: "website",
    categoryLabel: "Website & Digital Presence",
    tagline: "Consistent social presence with branded graphics",
    advertisedPrice: "₹2,999/mo",
    setupFee: "₹0 setup",
    recurringFee: "₹2,999 / month",
    description: "8 planned social media posts per month. Client supplies photos, Abhibhi crafts branded designs and post copy.",
    deliverables: [
      "8 planned social media graphics per month",
      "Engaging post captions & relevant hashtag strategy",
      "Agreed brand styling & monthly content calendar",
      "Publishing assistance & monthly reach summary",
    ],
    exclusions: ["On-site photography or videography", "Paid ad management"],
    bestFor: "Cafes, retail stores, fitness coaches, local brands",
  },
  {
    id: "website-care-backups",
    name: "Website Care & Backups",
    category: "website",
    categoryLabel: "Website & Digital Presence",
    tagline: "Security, continuous updates, and automated backups",
    advertisedPrice: "₹1,499–₹1,999/mo",
    setupFee: "₹0 setup",
    recurringFee: "₹1,499 – ₹1,999 / month",
    description: "Regular WordPress/system updates, weekly automated backups, security scanning, and uptime monitoring.",
    deliverables: [
      "Scheduled plugin, core and dependency updates",
      "Automated off-site cloud backups",
      "24/7 uptime monitoring & instant downtime alerts",
      "Basic security audit and malware scanning",
    ],
    exclusions: ["Major redesigns or new feature development", "Third-party server outage repairs"],
    bestFor: "Anyone with an existing website wanting peace of mind",
  },

  // ── Category 02: Software & SaaS Solutions ──────────────────
  {
    id: "cloud-saas-starter",
    name: "Cloud SaaS Starter",
    category: "saas",
    categoryLabel: "Software & SaaS Solutions",
    tagline: "Ready-to-use cloud business management software",
    advertisedPrice: "₹6,499+ / ₹2,499/mo",
    setupFee: "₹6,499+ setup",
    recurringFee: "₹2,499 / month",
    badge: "SaaS",
    description: "Turnkey cloud software tailored for small business workflows, client records, invoicing, and user authentication.",
    deliverables: [
      "Cloud database setup & user role-based access",
      "Core business management modules (Customers, Invoices, Tasks)",
      "Secure hosting deployment on modern cloud servers",
      "Monthly maintenance, patch updates & technical support",
    ],
    exclusions: ["Custom enterprise workflow re-engineering", "Dedicated private cloud infrastructure"],
    bestFor: "Service businesses, consultants, agencies, wholesalers",
  },
  {
    id: "school-management",
    name: "School Management System",
    category: "saas",
    categoryLabel: "Software & SaaS Solutions",
    tagline: "Students, teachers, fees, attendance and academic schedules",
    advertisedPrice: "₹9,499+ / ₹1,999/mo",
    setupFee: "₹9,499+ setup",
    recurringFee: "₹1,999 / month",
    isPopular: true,
    description: "End-to-end institutional management: student admissions, fee tracking, teacher rosters, exam schedules, and parent alerts.",
    deliverables: [
      "Student & teacher profiles with enrollment tracking",
      "Fee payment status, receipt generation & pending dues tracking",
      "Daily attendance logging & class schedule management",
      "Cloud deployment & monthly support updates",
    ],
    exclusions: ["SMS gateway gateway credits (charged at actuals)", "Biometric hardware installation"],
    bestFor: "Schools, tuition centers, academies, coaching institutes",
  },
  {
    id: "ecommerce-ops",
    name: "E-commerce Operations System",
    category: "saas",
    categoryLabel: "Software & SaaS Solutions",
    tagline: "Centralized inventory, multi-channel orders & customer database",
    advertisedPrice: "₹12,999+ / ₹2,499/mo",
    setupFee: "₹12,999+ setup",
    recurringFee: "₹2,499 / month",
    description: "Centralized operational backend for multi-product retailers to manage real-time inventory, packing slips, and order stages.",
    deliverables: [
      "Product & SKU inventory tracking with low-stock alerts",
      "Order processing pipeline (Pending, Packed, Shipped, Delivered)",
      "Customer contact history & purchase logs",
      "Monthly software updates and database maintenance",
    ],
    exclusions: ["Custom warehouse robotics / automated barcode hardware", "Carrier API usage costs"],
    bestFor: "Growing online retailers, wholesalers, direct-to-consumer brands",
  },
  {
    id: "travel-ride-booking",
    name: "Travel / Ride Booking System",
    category: "saas",
    categoryLabel: "Software & SaaS Solutions",
    tagline: "Bookings, fleet management, driver dispatch and payment tracking",
    advertisedPrice: "₹17,999+ / ₹3,499/mo",
    setupFee: "₹17,999+ setup",
    recurringFee: "₹3,499 / month",
    badge: "Logistics",
    description: "Digital booking and dispatch software for travel operators, taxi fleets, and tour agencies with route tracking.",
    deliverables: [
      "Passenger booking interface & itinerary management",
      "Driver and vehicle assignment panel",
      "Fare calculation, invoice generation & advance deposits",
      "Monthly hosting support, bugfixes & performance tuning",
    ],
    exclusions: ["Google Maps API usage fees above free tier", "Driver smartphone devices"],
    bestFor: "Cab aggregators, tour operators, car rentals, logistics companies",
  },
  {
    id: "clinic-hospital-management",
    name: "Clinic / Hospital Management",
    category: "saas",
    categoryLabel: "Software & SaaS Solutions",
    tagline: "Patients, OPD appointments, billing, staff, and medical records",
    advertisedPrice: "₹17,999+ / ₹3,999/mo",
    setupFee: "₹17,999+ setup",
    recurringFee: "₹3,999 / month",
    description: "Secure healthcare workflow solution for outpatient appointments, doctor schedules, patient billing, and visit records.",
    deliverables: [
      "Patient registration, OPD queue & appointment scheduling",
      "Consultation notes, prescription templates & diagnostic records",
      "Medical billing, invoice receipts & doctor payout reports",
      "Encrypted patient data storage & compliance maintenance",
    ],
    exclusions: ["Third-party lab analyzer device drivers", "Government regulatory audit certifications"],
    bestFor: "Polyclinics, private hospitals, dental clinics, diagnostic centers",
  },
  {
    id: "real-estate-property",
    name: "Real Estate / Property System",
    category: "saas",
    categoryLabel: "Software & SaaS Solutions",
    tagline: "Property listings, buyer enquiries, agent assignments, and CRM",
    advertisedPrice: "₹12,999+ / ₹2,499/mo",
    setupFee: "₹12,999+ setup",
    recurringFee: "₹2,499 / month",
    description: "Property portal and lead CRM allowing agents to showcase plots, apartments, track site visit schedules, and close deals.",
    deliverables: [
      "Property listings with photo galleries, pricing & specifications",
      "Buyer enquiry CRM with lead stage assignment",
      "Agent profile management & site visit calendar",
      "Cloud hosting, regular backups and ongoing support",
    ],
    exclusions: ["Virtual 3D tour photography", "Paid property portal syndication fees"],
    bestFor: "Real estate brokers, property developers, rental agencies",
  },
  {
    id: "other-business-solutions",
    name: "Custom Business Software",
    category: "saas",
    categoryLabel: "Software & SaaS Solutions",
    tagline: "Bespoke internal tools, inventory, HR, accounting and ERPs",
    advertisedPrice: "Custom Quote",
    setupFee: "Custom Quote",
    recurringFee: "Based on requirements",
    description: "Custom-developed software tailored precisely to your specific internal workflows, legacy databases, or proprietary business model.",
    deliverables: [
      "Comprehensive requirement discovery and architectural plan",
      "Custom UI/UX and database design built from scratch",
      "Third-party API & hardware integration as specified",
      "Dedicated deployment, staff training & SLA support plan",
    ],
    exclusions: ["Undocumented legacy system reverse engineering"],
    bestFor: "Manufacturing units, specialized logistics, enterprises",
  },

  // ── Category 03: AI & Automation Add-ons ─────────────────────
  {
    id: "ai-business-analyst",
    name: "AI Business Analyst",
    category: "ai",
    categoryLabel: "AI & Automation Add-ons",
    tagline: "Automated sales summaries, revenue reports & bottleneck alerts",
    advertisedPrice: "₹3,999+ / ₹1,999/mo",
    setupFee: "₹3,999+ setup",
    recurringFee: "₹1,999 / month",
    badge: "AI Tool",
    description: "Connects to your sales and operational database to deliver automated daily or weekly executive summaries and identify leaks.",
    deliverables: [
      "Automated weekly sales summaries & performance reports",
      "Revenue trend analysis and anomaly detection",
      "Operational bottleneck alerts delivered via email or dashboard",
      "Continuous prompt tuning and database connector updates",
    ],
    exclusions: ["AI LLM provider API token costs (billed at exact OpenAI/Anthropic rates)", "Manual financial audits"],
    bestFor: "Founders, business owners, operational directors",
  },
  {
    id: "ai-customer-support",
    name: "AI Customer Support Agent",
    category: "ai",
    categoryLabel: "AI & Automation Add-ons",
    tagline: "24/7 automated FAQ responses, ticket handling & smart escalation",
    advertisedPrice: "₹3,999+ / ₹2,499/mo",
    setupFee: "₹3,999+ setup",
    recurringFee: "₹2,499 / month",
    isPopular: true,
    description: "Trained on your business knowledge base to answer customer questions 24/7, route leads, and escalate complex cases to human staff.",
    deliverables: [
      "Custom-trained chatbot embedding your website FAQs & services",
      "Website widget integration with brand colors",
      "Smart sentiment-based escalation to WhatsApp / Human agent",
      "Conversation logs, user question analytics and periodic tuning",
    ],
    exclusions: ["WhatsApp Business API BSP per-message fees (Meta rates)", "Voice telephony integration"],
    bestFor: "Customer service teams, e-commerce stores, tech startups",
  },
  {
    id: "lead-followup-reminders",
    name: "Lead Follow-up & Reminders",
    category: "ai",
    categoryLabel: "AI & Automation Add-ons",
    tagline: "Automated email and WhatsApp nurturing so no lead goes cold",
    advertisedPrice: "₹2,999+ / ₹1,499/mo",
    setupFee: "₹2,999+ setup",
    recurringFee: "₹1,499 / month",
    description: "Automated multi-step reminder sequence when a customer submits an enquiry, books an appointment, or abandons checkout.",
    deliverables: [
      "Automated lead acknowledgement within 60 seconds",
      "Scheduled follow-up sequence (Day 1, Day 3, Day 7)",
      "Appointment & invoice payment reminder triggers",
      "Integration with CRM or spreadsheet lead trackers",
    ],
    exclusions: ["Third-party messaging credits (Meta WhatsApp / Twilio)", "Cold spam prospecting lists"],
    bestFor: "Consultants, clinics, realtors, sales teams",
  },
  {
    id: "invoice-payment-workflow",
    name: "Invoice & Payment Workflow",
    category: "ai",
    categoryLabel: "AI & Automation Add-ons",
    tagline: "Automated GST invoices, payment link dispatch & reconciliation",
    advertisedPrice: "₹3,999+",
    setupFee: "₹3,999+ one-time",
    recurringFee: "₹0 Abhibhi recurring",
    description: "Streamline billing by auto-generating PDF invoices, emailing payment links with QR codes, and marking payments as received.",
    deliverables: [
      "Branded GST invoice PDF generator with auto serial numbering",
      "Automated payment link delivery via Email / SMS",
      "Webhook reconciliation to auto-update order status",
      "Payment reminder triggers before and on due date",
    ],
    exclusions: ["Payment gateway transaction fees (approx. 2%)", "Statutory tax filing filings"],
    bestFor: "Freelancers, agencies, B2B suppliers, service providers",
  },
  {
    id: "custom-ai-agent",
    name: "Custom AI Agent Integration",
    category: "ai",
    categoryLabel: "AI & Automation Add-ons",
    tagline: "Domain-specific AI autonomous workflows and internal actions",
    advertisedPrice: "₹6,499+ / ₹2,999/mo",
    setupFee: "₹6,499+ setup",
    recurringFee: "₹2,999 / month",
    badge: "Advanced",
    description: "Tailored AI agent capable of multi-step reasoning, searching internal documentation, querying databases, and executing verified actions.",
    deliverables: [
      "Custom system prompt engineering & proprietary RAG knowledge retrieval",
      "Tool-calling integration with your existing CRM or internal APIs",
      "Human-in-the-loop confirmation gates for sensitive actions",
      "Dedicated monitoring, prompt optimization & model upgrades",
    ],
    exclusions: ["Raw model token consumption (billed at direct provider cost)"],
    bestFor: "Enterprises, law firms, financial institutions, scaling startups",
  },

  // ── Category 04: 7-Day Local Lead-Boost Pilot ───────────────
  {
    id: "7-day-lead-pilot",
    name: "7-Day Local Lead-Boost Pilot",
    category: "pilot",
    categoryLabel: "7-Day Local Lead-Boost Pilot",
    tagline: "Test measurable improvements before committing to big marketing spends",
    advertisedPrice: "Request a Quote",
    setupFee: "Pilot Pricing TBD",
    recurringFee: null,
    badge: "Limited Scope",
    description: "A focused 7-day sprint where we audit your local presence, implement three high-impact fixes, and measure the difference together.",
    deliverables: [
      "FREE initial 10-minute digital presence check and diagnostic report",
      "Baseline measurement of calls, WhatsApp clicks & website queries",
      "Implementation of 3 agreed rapid fixes (e.g. Map profile, CTA, speed)",
      "Day 7 live review session to evaluate measurable enquiry changes",
      "Clear, honest recommendation on whether scaling marketing is viable",
    ],
    exclusions: ["Guaranteed customer count increases or revenue figures", "Guaranteed Google search ranking positions"],
    bestFor: "Local businesses skeptical of marketing agencies who want proof first",
  },
]

const FAQS = [
  {
    q: "What does the one-time price include?",
    a: "One-time prices cover the agreed design, development, configuration, testing, and deployment to your chosen server or hosting environment as outlined in the package scope. They do not include ongoing monthly server hosting, domain renewals, or future major feature additions.",
  },
  {
    q: "Why do some products display a plus sign (+)?",
    a: "The plus sign indicates a starting price. Every business has unique needs—additional product catalogs, custom integrations, extra user roles, or multi-branch requirements will be scoped and quoted transparently before any work starts.",
  },
  {
    q: "Why do SaaS products have monthly charges?",
    a: "SaaS systems require active cloud database servers, ongoing security patches, bug fixes, data backups, and technical support. The monthly fee keeps your software running smoothly 24/7 without unexpected downtime.",
  },
  {
    q: "Are hosting and domain charges included in website packages?",
    a: "No. Domain registration (approx. ₹800–₹1,200/year) and web hosting (approx. ₹1,500–₹3,500/year) are third-party services owned directly by you. We guide you through purchasing them or deploy on your existing provider so you always own your digital assets.",
  },
  {
    q: "Are AI model and API charges included?",
    a: "Our fee covers the setup, architecture, prompt engineering, integration, and maintenance of the AI agents. Raw token consumption from AI providers (such as OpenAI, Anthropic, or Google Gemini) is billed directly at cost by the respective provider.",
  },
  {
    q: "Are WhatsApp and SMS messaging charges included?",
    a: "No. Messaging platforms (Meta WhatsApp Business API, Twilio, Fast2SMS) charge per-conversation or per-message fees. We configure and connect your approved account; carrier charges are paid directly to the provider.",
  },
  {
    q: "Can I request a custom feature for my SaaS or website?",
    a: "Yes! All our software can be extended. If you need a custom workflow, report, or integration, we will provide a clear, itemized quote based on estimated development hours.",
  },
  {
    q: "Can the software be deployed on my own computer or private server?",
    a: "Yes. We support deployment to cloud providers (AWS, DigitalOcean, Vercel, VPS) as well as private on-premise local servers where applicable. Specific requirements will be evaluated during discovery.",
  },
  {
    q: "What happens if I cancel a monthly subscription?",
    a: "You can cancel anytime with 30 days notice. Your data belongs to you—we will provide a complete database export so you can retain your business records.",
  },
  {
    q: "Is technical support included after delivery?",
    a: "Yes. All setup packages include 14 days of post-launch stabilization support. Monthly subscription plans include continuous support for bug fixes, performance monitoring, and system uptime.",
  },
  {
    q: "How does the 7-day Local Lead-Boost Pilot work?",
    a: "We start with a free 10-minute check of your online visibility. If you choose the pilot, we agree on exactly three critical bottlenecks to fix, implement them immediately, and measure enquiries over 7 days before you invest in larger marketing.",
  },
  {
    q: "Can I book a consultation before purchasing?",
    a: "Absolutely. We encourage a free 15-minute consultation to understand your business requirements and ensure you pick the most cost-effective package.",
  },
  {
    q: "Are specific results or Google search rankings guaranteed?",
    a: "No reputable technology partner can guarantee specific rankings or customer sales numbers, as Google algorithms and market demand vary. We guarantee technical excellence, best-practice optimization, and verified deliverables.",
  },
]

export default function PricingClient() {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "website" | "saas" | "ai" | "pilot">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  // Enquiry form state
  const [formData, setFormData] = useState({
    name: "",
    businessName: "",
    email: "",
    phone: "",
    businessType: "",
    serviceId: "starter-website",
    budget: "under-10k",
    requirements: "",
    preferredContact: "WhatsApp",
    isConsultationRequested: false,
    consent: false,
  })
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formSuccess, setFormSuccess] = useState(false)
  const [formError, setFormError] = useState("")

  const filteredServices = SERVICES.filter((service) => {
    const matchesCategory = selectedCategory === "all" || service.category === selectedCategory
    const matchesSearch =
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setFormError("Please fill in your name, email, and phone number.")
      return
    }
    if (!formData.consent) {
      setFormError("Please check the consent box to proceed.")
      return
    }

    setFormSubmitting(true)

    try {
      const selectedServiceName = SERVICES.find((s) => s.id === formData.serviceId)?.name || formData.serviceId
      const res = await fetch("/api/public/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          serviceName: selectedServiceName,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setFormSuccess(true)
      } else {
        setFormError(data.error || "Failed to submit enquiry. Please try again or message us directly.")
      }
    } catch (err: any) {
      setFormError("Network error. Please try again.")
    } finally {
      setFormSubmitting(false)
    }
  }

  const scrollToEnquiry = (serviceId?: string) => {
    if (serviceId) {
      setFormData((prev) => ({ ...prev, serviceId }))
    }
    const el = document.getElementById("consultation-form")
    if (el) {
      el.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-rose-100 selection:text-rose-900 font-sans">

      {/* ── SECTION B: HERO ─────────────────────────────────── */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-zinc-50/80 via-white to-white border-b border-zinc-100 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-4 py-1.5 rounded-full mb-6 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
            Transparent Pricing · No Hidden Fees · Tailored for Growth
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-zinc-950 mb-6 leading-tight">
            Transform Your Business with{" "}
            <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-violet-600 bg-clip-text text-transparent">
              Modern Software, AI &amp; Automation
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-zinc-600 text-lg sm:text-xl leading-relaxed mb-8">
            Ready-to-use SaaS solutions, custom development, AI agents and cloud deployment — all in one place with clear, upfront pricing.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <button
              onClick={() => {
                const el = document.getElementById("pricing-catalog")
                el?.scrollIntoView({ behavior: "smooth" })
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg shadow-rose-500/20 hover:shadow-rose-500/35 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              Explore Pricing
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollToEnquiry()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 font-semibold px-8 py-4 rounded-xl text-base shadow-xs transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-rose-600" />
              Book a Free Consultation
            </button>
          </div>

          {/* 4 Benefit Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            {[
              { title: "Increase Enquiries", desc: "Turn online visitors into paying leads", icon: Zap },
              { title: "Automate Operations", desc: "Save hours on repetitive manual work", icon: Cpu },
              { title: "Save Time & Cost", desc: "Low monthly fees with proven tools", icon: BarChart2 },
              { title: "Support Business Growth", desc: "Scalable architecture that grows with you", icon: CheckCircle2 },
            ].map((b) => (
              <div
                key={b.title}
                className="bg-white border border-zinc-200/90 rounded-xl p-4 shadow-xs hover:border-zinc-300 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center mb-3">
                  <b.icon className="w-4 h-4 text-rose-600" />
                </div>
                <h2 className="font-bold text-zinc-900 text-sm mb-1">{b.title}</h2>
                <p className="text-zinc-500 text-xs leading-normal">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION C: PRICING OVERVIEW PILLARS ─────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-rose-600 text-xs font-bold uppercase tracking-widest mb-2">Service Catalog</p>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-950">Choose Your Solution Area</h2>
          <p className="text-zinc-600 max-w-2xl mx-auto mt-2 text-sm sm:text-base">
            All prices are in Indian Rupees (INR). Initial setup fees and monthly software maintenance are listed transparently.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              catId: "website",
              num: "01",
              title: "Website & Digital Presence",
              price: "₹1,499 – ₹17,999+",
              billing: "One-time & Monthly Care",
              desc: "Modern websites, Google Business Profile, local SEO, and monthly social media management.",
              icon: Globe2,
            },
            {
              catId: "saas",
              num: "02",
              title: "Software & SaaS Solutions",
              price: "₹6,499+ setup",
              billing: "Setup + ₹1,999–₹3,999/mo",
              desc: "Turnkey software for schools, clinics, real estate, ride booking, e-commerce, and general ERPs.",
              icon: Layers,
            },
            {
              catId: "ai",
              num: "03",
              title: "AI & Automation Add-ons",
              price: "₹2,999+ setup",
              billing: "Setup + ₹1,499–₹2,999/mo",
              desc: "AI customer support, automated lead follow-up, smart business analytics, and invoice workflows.",
              icon: Cpu,
            },
            {
              catId: "pilot",
              num: "04",
              title: "7-Day Local Lead-Boost",
              price: "Request a Quote",
              billing: "7-Day Sprint (Diagnostic Free)",
              desc: "Test practical improvements with a 10-minute diagnostic and 3 targeted fixes before scaling ad spends.",
              icon: Zap,
            },
          ].map((card) => (
            <div
              key={card.num}
              onClick={() => {
                setSelectedCategory(card.catId as any)
                const el = document.getElementById("pricing-catalog")
                el?.scrollIntoView({ behavior: "smooth" })
              }}
              className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedCategory === card.catId
                  ? "bg-rose-50/50 border-rose-400 shadow-md ring-2 ring-rose-400/20"
                  : "bg-white border-zinc-200/90 hover:border-zinc-300 hover:shadow-md"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                    {card.num}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center">
                    <card.icon className="w-4 h-4 text-zinc-700" />
                  </div>
                </div>
                <h3 className="font-black text-zinc-950 text-base mb-2">{card.title}</h3>
                <p className="text-zinc-600 text-xs leading-relaxed mb-4">{card.desc}</p>
              </div>

              <div className="pt-4 border-t border-zinc-100 mt-2">
                <p className="text-lg font-black text-zinc-950">{card.price}</p>
                <p className="text-zinc-500 text-[11px] mb-3">{card.billing}</p>
                <span className="text-xs font-bold text-rose-600 inline-flex items-center gap-1 group">
                  Explore Category <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION D, E, F, G: DETAILED PRICING CATALOG ───────── */}
      <section id="pricing-catalog" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          {/* Category Filter Tabs */}
          <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
            {[
              { id: "all", label: "All Services (19)" },
              { id: "website", label: "Websites & Presence" },
              { id: "saas", label: "Software & SaaS" },
              { id: "ai", label: "AI & Automation" },
              { id: "pilot", label: "7-Day Pilot" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === tab.id
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search services or features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => {
            const isExpanded = expandedCard === service.id
            return (
              <div
                key={service.id}
                className={`bg-white rounded-2xl border transition-all flex flex-col justify-between shadow-xs ${
                  service.isPopular
                    ? "border-rose-300 ring-1 ring-rose-200"
                    : "border-zinc-200 hover:border-zinc-300 hover:shadow-md"
                }`}
              >
                <div className="p-6">
                  {/* Category Pill & Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-md">
                      {service.categoryLabel}
                    </span>
                    {service.badge && (
                      <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {service.badge}
                      </span>
                    )}
                  </div>

                  {/* Title & Tagline */}
                  <h3 className="text-xl font-black text-zinc-950 mb-1">{service.name}</h3>
                  <p className="text-zinc-500 text-xs mb-4 min-h-[32px]">{service.tagline}</p>

                  {/* Pricing Box */}
                  <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 mb-5">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-2xl font-black text-zinc-950">{service.advertisedPrice}</span>
                      <span className="text-xs font-semibold text-zinc-500">
                        {service.recurringFee ? "Setup + Monthly" : "One-time"}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 space-y-0.5">
                      <p>
                        <span className="font-semibold text-zinc-700">Setup Fee:</span> {service.setupFee}
                      </p>
                      {service.recurringFee && (
                        <p>
                          <span className="font-semibold text-zinc-700">Maintenance/Subscription:</span>{" "}
                          {service.recurringFee}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Short Description */}
                  <p className="text-zinc-600 text-xs leading-relaxed mb-4">{service.description}</p>

                  {/* Key Inclusions (Top 3) */}
                  <div className="space-y-2 mb-4">
                    <p className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider">Included Deliverables:</p>
                    <ul className="space-y-1.5">
                      {(isExpanded ? service.deliverables : service.deliverables.slice(0, 3)).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-zinc-700">
                          <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Expandable Details Area */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-zinc-100 space-y-3">
                      <div>
                        <p className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider mb-1">Exclusions &amp; Dependencies:</p>
                        <ul className="space-y-1">
                          {service.exclusions.map((ex, idx) => (
                            <li key={idx} className="text-[11px] text-zinc-500 list-disc list-inside">
                              {ex}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 text-[11px] text-zinc-600">
                        <span className="font-semibold text-zinc-800">Best for:</span> {service.bestFor}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedCard(isExpanded ? null : service.id)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 mt-2 flex items-center gap-1 cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        Less details <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        View all deliverables &amp; exclusions <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Card Footer Button */}
                <div className="p-6 pt-0">
                  <button
                    onClick={() => scrollToEnquiry(service.id)}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white cursor-pointer shadow-xs"
                  >
                    Enquire for {service.name}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── SECTION H: WHAT IS INCLUDED IN PRICING? ───────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-zinc-50 border-y border-zinc-200/80">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-rose-600 text-xs font-bold uppercase tracking-widest">Commercial Transparency</span>
            <h2 className="text-3xl font-black text-zinc-950 mt-1">What is Included in Pricing?</h2>
            <p className="text-zinc-600 text-sm max-w-2xl mx-auto mt-2">
              “Your quotation will clearly separate the selected service fee from any applicable third-party or optional charges.”
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "One-Time Setup Fee",
                desc: "Covers architecture, custom design, system installation, feature configuration, and launch deployment.",
              },
              {
                title: "Monthly SaaS Maintenance",
                desc: "Covers cloud database backups, server uptime monitoring, framework security patches, and ongoing bug fixes.",
              },
              {
                title: "Third-Party Direct Costs",
                desc: "Domain registration, hosting, and API keys are owned directly by you so you maintain 100% asset independence.",
              },
              {
                title: "AI Token Usage at Cost",
                desc: "We configure OpenAI/Anthropic keys directly. You pay zero markup on raw model token consumption.",
              },
              {
                title: "Payment Gateway Approval",
                desc: "We connect Razorpay, UPI or Stripe. Transaction fees (~2%) are charged directly by the gateway provider.",
              },
              {
                title: "14-Day Post-Launch Support",
                desc: "Every completed project includes 14 days of dedicated stabilization support to resolve any initial glitches.",
              },
            ].map((p, i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-zinc-200/90 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-zinc-950 text-sm">{p.title}</h3>
                </div>
                <p className="text-zinc-600 text-xs leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION I: COMPARISON MATRIX ──────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-rose-600 text-xs font-bold uppercase tracking-widest">Side-by-Side</span>
          <h2 className="text-3xl font-black text-zinc-950 mt-1">Quick Comparison Matrix</h2>
          <p className="text-zinc-600 text-xs sm:text-sm mt-1">Summary of fees, recurring costs, and main deliverables across all offerings.</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 text-zinc-900 border-b border-zinc-200 font-bold uppercase text-[11px] tracking-wider">
                <th className="p-4">Service</th>
                <th className="p-4">Category</th>
                <th className="p-4">Initial Setup Fee</th>
                <th className="p-4">Recurring Fee</th>
                <th className="p-4 min-w-[240px]">Key Scope</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {SERVICES.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="p-4 font-bold text-zinc-950 flex items-center gap-2">
                    {s.name}
                    {s.isPopular && (
                      <span className="bg-rose-50 text-rose-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-rose-200">
                        Popular
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-zinc-500">{s.categoryLabel}</td>
                  <td className="p-4 font-semibold text-zinc-900">{s.setupFee}</td>
                  <td className="p-4 text-zinc-700">{s.recurringFee || "None"}</td>
                  <td className="p-4 text-zinc-600">{s.deliverables[0]}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => scrollToEnquiry(s.id)}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-bold text-xs cursor-pointer"
                    >
                      Enquire
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── SECTION J: CONSULTATION & ENQUIRY FORM ────────────── */}
      <section id="consultation-form" className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50 border-t border-zinc-200/80 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-rose-600 text-xs font-bold uppercase tracking-widest">Let's Discuss Your Project</span>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 mt-1">Book a Free Consultation or Request a Quote</h2>
            <p className="text-zinc-600 text-sm mt-2">
              Fill out your requirements below. Our technical team will get back to you within 2 hours with a clear, itemized proposal.
            </p>
          </div>

          <div className="bg-white p-8 sm:p-10 rounded-3xl border border-zinc-200 shadow-sm">
            {formSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-zinc-950 mb-2">Enquiry Received Successfully!</h3>
                <p className="text-zinc-600 text-sm mb-6 max-w-md mx-auto">
                  Thank you, <strong>{formData.name}</strong>. We have received your request for{" "}
                  <strong>{SERVICES.find((s) => s.id === formData.serviceId)?.name || "Software Services"}</strong>. Our team will contact you via {formData.preferredContact} shortly.
                </p>
                <button
                  onClick={() => {
                    setFormSuccess(false)
                    setFormData((prev) => ({ ...prev, requirements: "" }))
                  }}
                  className="px-6 py-2.5 bg-zinc-900 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-zinc-800"
                >
                  Submit Another Enquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnquirySubmit} className="space-y-5">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                    {formError}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Abhimanyu Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Health Clinic"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="you@domain.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Phone / WhatsApp Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Primary Service of Interest</label>
                    <select
                      value={formData.serviceId}
                      onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white"
                    >
                      {SERVICES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.advertisedPrice})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Estimated Budget Range</label>
                    <select
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white"
                    >
                      <option value="under-10k">Under ₹10,000</option>
                      <option value="10k-25k">₹10,000 – ₹25,000</option>
                      <option value="25k-50k">₹25,000 – ₹50,000</option>
                      <option value="50k-plus">₹50,000+ (Custom Enterprise)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Project Requirements or Questions</label>
                  <textarea
                    rows={3}
                    placeholder="Tell us briefly about what you want to build or automate..."
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isConsultationRequested}
                        onChange={(e) => setFormData({ ...formData, isConsultationRequested: e.target.checked })}
                        className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
                      />
                      <span>Request a free 15-minute phone/video consultation</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.consent}
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                        className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
                      />
                      <span>I agree to be contacted regarding this quotation *</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-8 py-3.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/20 hover:shadow-rose-500/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {formSubmitting ? (
                      "Submitting..."
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Send Enquiry
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION K: FREQUENTLY ASKED QUESTIONS ─────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-rose-600 text-xs font-bold uppercase tracking-widest">Questions &amp; Answers</span>
          <h2 className="text-3xl font-black text-zinc-950 mt-1">Frequently Asked Questions</h2>
          <p className="text-zinc-600 text-xs sm:text-sm mt-1">Everything you need to know about our pricing, terms, and delivery process.</p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx
            return (
              <div
                key={idx}
                className="border border-zinc-200/90 rounded-2xl overflow-hidden bg-white shadow-xs transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-zinc-950 text-sm cursor-pointer hover:bg-zinc-50"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="p-5 pt-0 text-zinc-600 text-xs sm:text-sm leading-relaxed border-t border-zinc-100 bg-zinc-50/40">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── SECTION L: FINAL CTA & FOOTER HIGHLIGHTS ──────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="relative bg-gradient-to-br from-rose-50 via-pink-50/60 to-violet-50 border border-rose-200/80 rounded-3xl p-10 sm:p-14 overflow-hidden shadow-sm">
          <div className="relative z-10">
            <span className="text-rose-600 text-xs font-bold uppercase tracking-widest">Start Now</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 mt-2 mb-4">
              Let's Build Your Next Growth Story
            </h2>
            <p className="text-zinc-600 text-sm sm:text-base max-w-xl mx-auto mb-8">
              Tell us about your business, and we will help you choose a suitable software, automation or digital-growth solution.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => scrollToEnquiry()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold px-8 py-4 rounded-xl text-sm shadow-lg shadow-rose-500/20 hover:shadow-rose-500/35 transition-all cursor-pointer"
              >
                Get Started Today
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollToEnquiry()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-900 font-bold px-8 py-4 rounded-xl text-sm shadow-xs transition-all cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-rose-600" />
                Book a Free Consultation
              </button>
            </div>

            {/* Quick Contact Info */}
            <div className="mt-10 pt-8 border-t border-rose-200/50 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-600 font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verified Delivery Process
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Transparent Invoicing
              </span>
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-rose-600" /> WhatsApp &amp; Email Support
              </span>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
