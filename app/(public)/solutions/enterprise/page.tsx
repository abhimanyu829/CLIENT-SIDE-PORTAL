import type { Metadata } from "next"
import Link from "next/link"
import { EnquiryForm } from "@/components/public/EnquiryForm"
import { BrandSectionList } from "@/components/content/BrandBlocks"

export const metadata: Metadata = {
  title: "Enterprise Solutions | Custom Software & AI Automation | Abhibhideveloper",
  description:
    "Enterprise software, AI agents, workflow automation, dashboards, CRM workflows, APIs and integrations from Abhibhideveloper — scoped through discovery, a written quotation, implementation, testing and delivery.",
  alternates: { canonical: "/solutions/enterprise" },
}

const SECTIONS = [
  {
    heading: "What an enterprise technology solution means here",
    body: [
      "An enterprise engagement means a business-critical requirement that usually spans more than one system, team, or process. It typically needs a written scope, staged delivery, and clear operational ownership after launch — rather than a single off-the-shelf purchase.",
      "Abhibhideveloper evaluates each requirement on its merits. If an existing product fits, we will say so. If a custom build, integration, or automation is needed, we will scope it honestly, including what is out of scope.",
    ],
  },
  {
    heading: "Business problems we can evaluate",
    list: [
      "Repetitive manual work that consumes staff time: data entry, routing, follow-ups, report assembly.",
      "Fragmented tooling where information lives in several systems without a reliable connection between them.",
      "Customer-facing workflows that need a controlled, auditable application instead of spreadsheets and email.",
      "Internal operations that need dashboards and metrics built on data the business already holds.",
      "New digital products that need to be taken from a requirements document to a working application.",
    ],
  },
  {
    heading: "AI agents and workflow automation",
    body: [
      "Where a task is high-volume, text-heavy, and low-risk, an AI agent or automation may reduce handling time. Typical candidates include answering questions from an approved knowledge base, summarising long threads, classifying and routing requests, and drafting first responses for human review.",
      "We do not present AI as a replacement for consequential decision-making. Money movement, legal, medical, employment, and security decisions keep a human in the loop. Model choice, data handling, and failure behaviour are agreed before implementation, and outputs are reviewed before they are relied on.",
    ],
  },
  {
    heading: "Custom software, SaaS, dashboards, CRM workflows, APIs and integrations",
    body: [
      "Depending on feasibility, an engagement may include a web application, an admin panel or dashboard, a CRM-style workflow, an API for your other systems, an integration between services you already use, or a subscription-based tool for your own customers.",
      "Whether a specific integration is possible depends on the third-party system's documented API, authentication model, rate limits, and terms. We confirm this during scoping rather than assuming it.",
    ],
  },
  {
    heading: "Engagement and discovery process",
    steps: [
      { title: "1. Enquiry", text: "You describe the business problem, the systems involved, and the outcome you need." },
      { title: "2. Discovery", text: "We clarify users, data, integrations, constraints, timeline, and budget. This is where feasibility is genuinely established." },
      { title: "3. Scope and quotation", text: "A written proposal covers deliverables, exclusions, milestones, pricing, payment schedule, and acceptance criteria." },
      { title: "4. Implementation", text: "Work proceeds in agreed stages. Changes outside scope are quoted separately rather than absorbed silently." },
      { title: "5. Testing and delivery", text: "Deliverables are checked against the agreed scope, then handed over with deployment instructions where included." },
      { title: "6. Support", text: "Ongoing maintenance, monitoring, and support apply only if the agreement includes them." },
    ],
  },
  {
    heading: "Deployment, maintenance, support and dependencies",
    body: [
      "Deployment may involve domain and environment configuration, integrations, and access to infrastructure you own. Production deployment depends on the availability of that infrastructure, the necessary permissions, and third-party services.",
      "Maintenance is provided only to the extent stated in the agreement: defect fixes against the agreed scope, compatible dependency updates, diagnostics, monitoring, and configuration help. New features, redesigns, migrations, and problems caused by unsupported modifications are separate work.",
      "Most solutions depend on third-party services — hosting, databases, payment gateways, email, or AI providers. Their availability, pricing, and terms affect the final system, and material dependencies are identified during scoping.",
    ],
  },
  {
    heading: "Security, access control and data handling",
    body: [
      "Access control is enforced on the server, not in the browser. Administrative and customer functions are separated, and sensitive operations require appropriate authorization. Personal data is handled according to our Privacy Policy and applicable law.",
      "We do not claim certifications, compliance frameworks, or audit credentials that Abhibhideveloper does not hold. If your organisation requires a specific security review or contractual control, raise it during discovery so we can confirm honestly whether it can be met.",
    ],
  },
  {
    heading: "Customization and integration feasibility",
    body: [
      "Customisation is normal in enterprise work, but feasibility is determined by documented interfaces and data models — not by ambition. If a third-party system has no supported API or forbids the intended use, we will say so and propose an alternative.",
      "Where an integration is technically possible but operationally risky (rate limits, transaction semantics, or irreversibility), the proposal will state the constraint and the agreed mitigation.",
    ],
  },
]

const FAQ = [
  { q: "Is enterprise work subject to minimum project size?", a: "Engagements are assessed individually. Larger or multi-system scopes usually need a discovery phase before a quotation can be issued." },
  { q: "Do you offer a dedicated account manager or custom SLA?", a: "No such commitment is made here. Response and support arrangements are whatever the written agreement actually specifies." },
  { q: "Can you work with our existing systems and vendors?", a: "Often yes, when the systems expose documented APIs or supported import/export mechanisms. This is confirmed during discovery." },
  { q: "How is pricing determined?", a: "From the agreed scope: features, integrations, data work, timelines, and ongoing responsibilities. Pricing is stated in the quotation before paid work begins." },
  { q: "Do you offer compliance certifications?", a: "No. We do not claim certifications we do not hold. Specific security or compliance requirements should be raised during discovery." },
]

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 pt-16 pb-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">Solutions · Enterprise</p>
          <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-balance">
            Enterprise software, AI automation and integrations — scoped before they are promised
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Abhibhideveloper works with businesses, operations teams, and technical decision-makers who need
            a custom application, an integration, an internal dashboard, or automation of a repetitive
            process. Every engagement starts with discovery, produces a written scope and quotation, and is
            delivered in agreed stages — subject to technical feasibility, resource availability, and the
            agreed terms.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#enterprise-enquiry" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
              Start an enterprise enquiry
            </Link>
            <Link href="/how-it-works" className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent/10">
              See the delivery process
            </Link>
            <Link href="/services" className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent/10">
              Browse services
            </Link>
          </div>
        </div>
      </section>

      <BrandSectionList sections={SECTIONS} eyebrow="Enterprise solutions" />

      <section className="border-t border-border px-4 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Enterprise questions</h2>
          <dl className="mt-6 space-y-4">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-2xl border border-border bg-card p-5">
                <dt className="text-base font-semibold">{f.q}</dt>
                <dd className="mt-2 text-[15px] leading-7 text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="enterprise-enquiry" className="border-t border-border px-4 py-14 bg-card/40">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Enterprise enquiry</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Tell us about the requirement. Share only what you are comfortable sending through a web form —
            avoid confidential system details until a secure channel is agreed.
          </p>
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <EnquiryForm categories={["enterprise", "custom-software-ai", "product-pricing"]} defaultCategory="enterprise" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Enterprise engagements are subject to technical feasibility, resource availability, agreed scope,
            pricing, and contract terms.
          </p>
        </div>
      </section>
    </div>
  )
}