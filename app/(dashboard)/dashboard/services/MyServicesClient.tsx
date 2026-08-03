"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertCircle, ArrowRight, Box, Clock3, RefreshCw, Server } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Service = {
  id: string
  status: string
  expiryDate: string | null
  estimatedCompletionAt: string | null
  product: { name: string; slug: string; thumbnailUrl: string | null; iconUrl: string | null }
  orderItem: { name: string }
  deployment: { status: string } | null
}

const statusTone: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DEPLOYING: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_DEPLOYMENT: "bg-amber-50 text-amber-700 border-amber-200",
  PAUSED: "bg-slate-100 text-slate-700 border-slate-200",
  SUSPENDED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-red-50 text-red-700 border-red-200",
}

export default function MyServicesClient() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/services", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Unable to load services")
      setServices(payload.data ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load services")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Customer workspace</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">My Services</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Deployment progress, access details, upgrades, renewals, and support for every purchased service.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> Refresh
        </Button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-4 w-4" /> {error}</div>}

      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border bg-card" />)}</div> : services.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-center"><Box className="mb-4 h-10 w-10 text-muted-foreground" /><h2 className="text-lg font-semibold">No managed services yet</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Purchased software requiring deployment appears here after payment verification.</p><Button asChild className="mt-5"><Link href="/marketplace">Browse marketplace</Link></Button></CardContent></Card>
      ) : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{services.map((service) => {
        const awaiting = service.status === "PENDING_DEPLOYMENT" || service.status === "DEPLOYING"
        return <Card key={service.id} className="group overflow-hidden transition-shadow hover:shadow-md"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="rounded-xl border bg-muted p-2.5"><Server className="h-5 w-5 text-primary" /></div><Badge variant="outline" className={statusTone[service.status] ?? ""}>{service.status.replaceAll("_", " ")}</Badge></div><CardTitle className="pt-3 text-lg">{service.product.name}</CardTitle><CardDescription>{service.orderItem.name}</CardDescription></CardHeader><CardContent className="space-y-4">{awaiting ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><div className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4" /> {service.deployment?.status?.replaceAll("_", " ") ?? "Preparing deployment"}</div>{service.estimatedCompletionAt && <p className="mt-1 text-xs">Estimated completion: {new Date(service.estimatedCompletionAt).toLocaleString()}</p>}</div> : service.expiryDate ? <p className="text-sm text-muted-foreground">Renews or expires {new Date(service.expiryDate).toLocaleDateString()}</p> : <p className="text-sm text-muted-foreground">Lifetime service access</p>}<Button asChild className="w-full"><Link href={`/dashboard/services/${service.id}`}>Open workspace <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>
      })}</div>}
    </div>
  )
}
