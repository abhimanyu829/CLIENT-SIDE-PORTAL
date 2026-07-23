"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Sparkles } from "lucide-react"

type ServiceCard = { id: string; slug: string; title: string; description: string; imageUrl?: string | null; category?: { name: string; slug: string } | null; tags: { name: string; slug: string }[] }
type Discovery = { campaigns: { id: string; name: string; description?: string | null; bannerUrl?: string | null; backgroundUrl?: string | null; ctaLabel?: string | null; landingUrl?: string | null; tags: string[] }[]; collections: { id: string; name: string; description?: string | null; services: ServiceCard[] }[]; sections: { key: string; title: string; services: ServiceCard[] }[] }

function sessionKey() {
  const key = "nexusai-service-discovery-session"
  const current = window.localStorage.getItem(key)
  if (current) return current
  const created = crypto.randomUUID()
  window.localStorage.setItem(key, created)
  return created
}

function track(payload: Record<string, unknown>) {
  void fetch("/api/service-discovery/events", {
    method: "POST", headers: { "content-type": "application/json", "x-discovery-session": sessionKey() }, body: JSON.stringify(payload), keepalive: true,
  })
}

function ServiceCardView({ service }: { service: ServiceCard }) {
  return (
    <Link href={`/services/${service.slug}`} onClick={() => track({ eventType: "CLICK", servicePageId: service.id })} className="group min-w-[260px] max-w-[280px] rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-700/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><Sparkles className="h-5 w-5" /></div>
        {service.category && <span className="text-xs font-medium text-muted-foreground">{service.category.name}</span>}
      </div>
      <h3 className="mt-5 font-semibold text-foreground group-hover:text-amber-800">{service.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
      {service.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{service.tags.slice(0, 3).map((tag) => <span key={tag.slug} className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{tag.name}</span>)}</div>}
      <div className="mt-5 flex items-center text-sm font-medium text-amber-800">Explore <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
    </Link>
  )
}

export function ServiceDiscoveryShelf() {
  const [data, setData] = useState<Discovery | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/service-discovery?placement=services")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (active && payload?.success) setData(payload.data) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!data?.campaigns.length) return
    data.campaigns.forEach((campaign) => track({ eventType: "VIEW", campaignId: campaign.id, campaignEventType: "IMPRESSION" }))
  }, [data])

  if (!data) return null
  const shelves = [...data.sections, ...data.collections.map((collection) => ({ key: `collection-${collection.id}`, title: collection.name, services: collection.services }))].filter((section) => section.services.length > 0)
  if (!data.campaigns.length && !shelves.length) return null

  return (
    <section className="space-y-10" aria-label="Service discovery">
      {data.campaigns.map((campaign) => (
        <Link key={campaign.id} href={campaign.landingUrl || "/services"} onClick={() => track({ eventType: "CLICK", campaignId: campaign.id, campaignEventType: "CLICK" })} className="block overflow-hidden rounded-3xl border border-amber-800/15 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-7 shadow-sm transition hover:shadow-md">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">Service campaign</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{campaign.name}</h2>{campaign.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{campaign.description}</p>}</div>
            <span className="inline-flex w-fit items-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background">{campaign.ctaLabel || "Explore now"}<ArrowRight className="ml-2 h-4 w-4" /></span>
          </div>
        </Link>
      ))}
      {shelves.map((section) => (
        <div key={section.key} className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-bold tracking-tight text-foreground">{section.title}</h2><Link href="/services" className="text-sm font-medium text-amber-800 hover:underline">See all</Link></div>
          <div className="flex gap-4 overflow-x-auto pb-2">{section.services.map((service) => <ServiceCardView key={service.id} service={service} />)}</div>
        </div>
      ))}
    </section>
  )
}
