import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import ServiceLeadForm from "./ServiceLeadForm"
import ServiceRequestForm from "./ServiceRequestForm"
import { CheckCircle2, ChevronRight, Briefcase, Layers3, Sparkles, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await db.servicePage.findUnique({ where: { slug: slug } })
  if (!service) return { title: "Service Not Found" }
  return {
    title: service.seoTitle || `${service.title} | NexusAI Services`,
    description: service.seoDescription || service.heroSubheading,
  }
}

export default async function ServiceDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await db.servicePage.findUnique({
    where: { slug: slug },
    include: {
      category: true,
      features: { orderBy: { sortOrder: 'asc' } },
      technologies: { orderBy: { sortOrder: 'asc' } },
      faqs: { orderBy: { sortOrder: 'asc' } },
      portfolios: { orderBy: { sortOrder: 'asc' } },
      plans: { orderBy: { sortOrder: 'asc' } },
      addOns: { orderBy: { sortOrder: 'asc' } },
      mediaAssets: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      documents: { where: { isPublished: true }, orderBy: { sortOrder: 'asc' } }
    }
  })

  if (!service || !service.isActive) notFound()

  const businessBenefits = (service.businessBenefits as string[]) || []
  const technicalBenefits = (service.technicalBenefits as string[]) || []
  const useCases = (service.useCases as any[]) || []
  const workflows = (service.workflow as any[]) || []
  const industriesServed = Array.isArray(service.industriesServed) ? service.industriesServed : []
  const plans = service.plans || []
  const addOns = service.addOns || []
  const mediaAssets = service.mediaAssets || []
  const documents = service.documents || []
  const hasHeroImage = !!service.heroImageUrl

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative border-b border-gray-800 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-black to-black z-0 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 pt-32 pb-24 relative z-10">
          <div className="flex items-center gap-2 text-sm text-indigo-400 font-medium mb-8">
            <Link href="/services" className="hover:text-indigo-300">Services</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-400">{service.title}</span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {service.category?.name && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">
                    {service.category.name}
                  </span>
                )}
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-300">
                  Enterprise Service
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
                {service.heroHeading}
              </h1>
              <p className="text-lg md:text-xl text-gray-400 leading-relaxed mb-8">
                {service.heroSubheading}
              </p>
              {service.pricingGuidance && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1e293b] border border-gray-700 text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {service.pricingGuidance}
                </div>
              )}
            </div>
            
            {/* If there was a hero image, we would display it here, but we will use an abstract illustration for now */}
            <div className="hidden lg:flex items-center justify-center">
               <div className="w-full aspect-square max-w-md bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl absolute right-10 top-20" />
               <div className="relative w-full max-w-md aspect-[4/3] bg-[#0f172a]/80 backdrop-blur-xl border border-gray-800 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl">
                  {hasHeroImage ? (
                    <img src={service.heroImageUrl!} alt={service.title} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <Briefcase className="w-24 h-24 text-indigo-500/50" />
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          
          {/* Main Content Column */}
          <div className="lg:col-span-7 space-y-20">
            {/* Overview */}
            <section>
              <h2 className="text-3xl font-bold mb-6">Overview</h2>
              <div className="prose prose-invert prose-lg max-w-none text-gray-400 leading-relaxed whitespace-pre-wrap">
                {service.overview}
              </div>
              {service.category?.description && (
                <p className="mt-6 text-sm text-zinc-500 max-w-3xl">{service.category.description}</p>
              )}
            </section>

            {/* Service Highlights */}
            {service.features.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <Layers3 className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-3xl font-bold">Service Highlights</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {service.features.map((feature) => (
                    <div key={feature.id} className="rounded-2xl border border-gray-800 bg-[#0f172a] p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                          {feature.icon ? <span className="text-lg">{feature.icon}</span> : <Sparkles className="h-5 w-5" />}
                        </div>
                        <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                      </div>
                      <p className="text-sm leading-relaxed text-gray-400">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Benefits */}
            {(businessBenefits.length > 0 || technicalBenefits.length > 0) && (
              <section>
                <h2 className="text-3xl font-bold mb-8">Why Choose This Service?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {businessBenefits.length > 0 && (
                    <div className="bg-[#0f172a] p-8 rounded-2xl border border-gray-800">
                      <h3 className="text-xl font-semibold mb-6 text-indigo-400">Business Benefits</h3>
                      <ul className="space-y-4">
                        {businessBenefits.map((benefit: string, i: number) => (
                          <li key={i} className="flex gap-3 text-gray-300">
                            <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {technicalBenefits.length > 0 && (
                    <div className="bg-[#0f172a] p-8 rounded-2xl border border-gray-800">
                      <h3 className="text-xl font-semibold mb-6 text-purple-400">Technical Benefits</h3>
                      <ul className="space-y-4">
                        {technicalBenefits.map((benefit: string, i: number) => (
                          <li key={i} className="flex gap-3 text-gray-300">
                            <CheckCircle2 className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {useCases.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-8">Use Cases</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {useCases.map((useCase: any, i: number) => (
                    <div key={i} className="rounded-2xl border border-gray-800 bg-[#0f172a] p-5">
                      <p className="text-base font-semibold text-white mb-1">{useCase.title || useCase.name || `Use case ${i + 1}`}</p>
                      <p className="text-sm text-gray-400 leading-relaxed">{useCase.description || useCase}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {industriesServed.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-6">Industries Served</h2>
                <div className="flex flex-wrap gap-2">
                  {industriesServed.map((industry) => (
                    <Badge key={industry} variant="outline" className="border-gray-700 bg-white/5 text-gray-300">
                      {industry}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {service.technologies.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-8">Technology Stack</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {service.technologies.map((tech) => (
                    <div key={tech.id} className="rounded-2xl border border-gray-800 bg-[#0f172a] p-4 text-center">
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-gray-200">
                        {tech.iconUrl ? <img src={tech.iconUrl} alt={tech.name} className="h-6 w-6 object-contain" /> : tech.name.slice(0, 1)}
                      </div>
                      <p className="text-sm font-medium text-white">{tech.name}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {service.portfolios.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-8">Portfolio</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {service.portfolios.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-gray-800 bg-[#0f172a] p-6">
                      {item.imageUrl && (
                        <div className="mb-4 overflow-hidden rounded-xl border border-gray-800">
                          <img src={item.imageUrl} alt={item.title} className="h-48 w-full object-cover" />
                        </div>
                      )}
                      <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-400 leading-relaxed mb-4">{item.description}</p>
                      {Array.isArray(item.results) && item.results.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.results.map((result, idx: number) => (
                            <Badge key={`${item.id}-${idx}`} variant="secondary" className="bg-white/5 text-gray-200 hover:bg-white/10">
                              {String(result)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {item.projectUrl && (
                        <a
                          href={item.projectUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-300 hover:text-indigo-200"
                        >
                          View demo <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {service.faqs.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-8">FAQ</h2>
                <div className="space-y-4">
                  {service.faqs.map((faq) => (
                    <details key={faq.id} className="rounded-2xl border border-gray-800 bg-[#0f172a] p-5">
                      <summary className="cursor-pointer list-none text-base font-semibold text-white">
                        {faq.question}
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-gray-400 whitespace-pre-wrap">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {plans.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">$</span>
                  <h2 className="text-3xl font-bold">Plans</h2>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {plans.map((plan) => (
                    <div key={plan.id} className={`rounded-2xl border p-6 ${plan.isPopular ? "border-indigo-500/40 bg-indigo-500/10" : "border-gray-800 bg-[#0f172a]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                          {plan.billingLabel && <p className="mt-1 text-sm text-gray-400">{plan.billingLabel}</p>}
                        </div>
                        {plan.isPopular && <Badge className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">Popular</Badge>}
                      </div>
                      <div className="mt-5">
                        <p className="text-4xl font-black text-white">${Number(plan.price).toLocaleString()}</p>
                        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 mt-2">{plan.type.replace("_", " ")}</p>
                      </div>
                      {plan.description && <p className="mt-4 text-sm leading-relaxed text-gray-400">{plan.description}</p>}
                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <ul className="mt-5 space-y-3">
                          {plan.features.map((feature, idx: number) => (
                            <li key={`${plan.id}-${idx}`} className="flex gap-3 text-sm text-gray-300">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                              <span>{String(feature)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link
                        href={`/services/${service.slug}/checkout`}
                        className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                      >
                        Buy this plan
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {addOns.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white">+</span>
                  <h2 className="text-3xl font-bold">Add-On Marketplace</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {addOns.map((addon) => (
                    <div key={addon.id} className="rounded-2xl border border-gray-800 bg-[#0f172a] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{addon.name}</h3>
                          <p className="mt-1 text-sm text-gray-400">${Number(addon.price).toLocaleString()} {addon.currency}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {addon.isPopular && <Badge className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">Popular</Badge>}
                          {addon.bundleOnly && <Badge variant="outline" className="border-gray-700 text-gray-300">Bundle only</Badge>}
                          {addon.restricted && <Badge variant="outline" className="border-amber-700 text-amber-300">Restricted</Badge>}
                        </div>
                      </div>
                      {addon.description && <p className="mt-4 text-sm text-gray-400 leading-relaxed">{addon.description}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(mediaAssets.length > 0 || documents.length > 0) && (
              <section className="grid gap-6 lg:grid-cols-2">
                {mediaAssets.length > 0 && (
                  <div>
                    <h2 className="text-3xl font-bold mb-8">Media Library</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {mediaAssets.map((asset: any) => (
                        <div key={asset.id} className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0f172a]">
                          {asset.url ? (
                            asset.mediaType === "VIDEO" || asset.mediaType === "DEMO" ? (
                              <video controls className="h-44 w-full object-cover bg-black">
                                <source src={asset.url} />
                              </video>
                            ) : (
                              <img src={asset.url} alt={asset.altText || asset.title} className="h-44 w-full object-cover" />
                            )
                          ) : null}
                          <div className="p-4">
                            <p className="text-sm font-semibold text-white">{asset.title}</p>
                            {asset.caption && <p className="mt-1 text-sm text-gray-400">{asset.caption}</p>}
                            <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-zinc-500">{asset.mediaType}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {documents.length > 0 && (
                  <div>
                    <h2 className="text-3xl font-bold mb-8">Documents</h2>
                    <div className="space-y-4">
                      {documents.map((doc: any) => (
                        <article key={doc.id} className="rounded-2xl border border-gray-800 bg-[#0f172a] p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold text-white">{doc.title}</h3>
                              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-zinc-500">{doc.documentType}</p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                              v{doc.version}
                            </span>
                          </div>
                          {doc.summary && <p className="mt-3 text-sm text-gray-400 leading-relaxed">{doc.summary}</p>}
                          {doc.previewUrl && (
                            <a href={doc.previewUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-300 hover:text-indigo-200">
                              Preview <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {doc.demoUrl && (
                            <a href={doc.demoUrl} target="_blank" rel="noreferrer" className="mt-4 ml-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-300 hover:text-indigo-200">
                              Demo <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Workflow */}
            {workflows.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-8">How We Work</h2>
                <div className="space-y-6">
                  {workflows.map((step: any, i: number) => (
                    <div key={i} className="flex gap-6">
                      <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xl shrink-0">
                        {i + 1}
                      </div>
                      <div className="pt-2">
                        <h4 className="text-xl font-semibold mb-2">{step.title || `Step ${i + 1}`}</h4>
                        <p className="text-gray-400">{step.description || step}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar Form */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 space-y-6">
              <ServiceLeadForm servicePageId={service.id} />
              <ServiceRequestForm servicePageId={service.id} serviceTitle={service.title} />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
