"use client"

import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Category = {
  id: string
  name: string
  slug: string
}

type ServiceItem = {
  id: string
  type?: string
  mediaType?: string
  documentType?: string
  title?: string
  name?: string
  question?: string
  answer?: string
  description?: string
  icon?: string | null
  iconUrl?: string | null
  imageUrl?: string | null
  url?: string | null
  projectUrl?: string | null
  slug?: string | null
  summary?: string | null
  content?: string | null
  previewUrl?: string | null
  demoUrl?: string | null
  version?: string | null
  results?: unknown
  sortOrder?: number
  billingLabel?: string | null
  price?: number
  currency?: string
  features?: unknown
  isPopular?: boolean
  isActive?: boolean
  enabled?: boolean
  bundleOnly?: boolean
  restricted?: boolean
  altText?: string | null
  caption?: string | null
}

type ServicePlan = {
  id: string
  type: "SUBSCRIPTION" | "ONE_TIME"
  name: string
  billingLabel?: string | null
  price: number
  currency?: string
  description?: string | null
  features?: string[]
  isPopular?: boolean
  isActive?: boolean
  sortOrder?: number
}

type ServiceAddon = {
  id: string
  name: string
  description?: string | null
  price: number
  currency?: string
  enabled?: boolean
  bundleOnly?: boolean
  restricted?: boolean
  isPopular?: boolean
  sortOrder?: number
}

type ServiceMediaAsset = {
  id: string
  mediaType: "SCREENSHOT" | "VIDEO" | "DEMO" | "PREVIEW"
  title: string
  url: string
  caption?: string | null
  altText?: string | null
  isActive?: boolean
  sortOrder?: number
  metadata?: Record<string, unknown>
}

type ServiceDocument = {
  id: string
  documentType: "DOCUMENTATION" | "PROPOSAL" | "TERMS" | "GUIDE"
  title: string
  slug: string
  summary?: string | null
  content?: string | null
  previewUrl?: string | null
  demoUrl?: string | null
  version?: string
  isPublished?: boolean
  sortOrder?: number
  metadata?: Record<string, unknown>
}

type Service = {
  id: string
  title: string
  slug: string
  heroHeading: string
  heroSubheading: string
  heroImageUrl?: string | null
  overview: string
  pricingGuidance?: string | null
  isActive: boolean
  categoryId?: string | null
  category?: { id: string; name: string; slug: string } | null
  industriesServed?: string[]
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string[]
  businessBenefits?: string[]
  technicalBenefits?: string[]
  workflow?: unknown[]
  useCases?: unknown[]
  features: ServiceItem[]
  technologies: ServiceItem[]
  faqs: ServiceItem[]
  portfolios: ServiceItem[]
  plans: ServicePlan[]
  addOns: ServiceAddon[]
  mediaAssets: ServiceMediaAsset[]
  documents: ServiceDocument[]
}

const emptyFeature = { title: "", description: "", icon: "", sortOrder: 0 }
const emptyTechnology = { name: "", iconUrl: "", sortOrder: 0 }
const emptyFaq = { question: "", answer: "", sortOrder: 0 }
const emptyPortfolio = { title: "", description: "", imageUrl: "", projectUrl: "", results: "", sortOrder: 0 }
const emptyPlan = { type: "SUBSCRIPTION", name: "", billingLabel: "", price: 0, currency: "USD", description: "", features: "[]", isPopular: false, isActive: true, sortOrder: 0 }
const emptyAddon = { name: "", description: "", price: 0, currency: "USD", enabled: true, bundleOnly: false, restricted: false, isPopular: false, sortOrder: 0 }
const emptyMedia = { mediaType: "SCREENSHOT", title: "", url: "", caption: "", altText: "", isActive: true, sortOrder: 0, metadata: "{}" }
const emptyDocument = { documentType: "DOCUMENTATION", title: "", slug: "", summary: "", content: "", previewUrl: "", demoUrl: "", version: "1.0", isPublished: true, sortOrder: 0, metadata: "{}" }

export default function AdminServiceEditClient({ service, categories }: { service: Service; categories: Category[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [basic, setBasic] = useState({
    categoryId: service.categoryId ?? "",
    title: service.title,
    slug: service.slug,
    heroHeading: service.heroHeading,
    heroSubheading: service.heroSubheading,
    heroImageUrl: service.heroImageUrl ?? "",
    overview: service.overview,
    pricingGuidance: service.pricingGuidance ?? "",
    isActive: service.isActive,
    seoTitle: service.seoTitle ?? "",
    seoDescription: service.seoDescription ?? "",
    seoKeywords: (service.seoKeywords ?? []).join(", "),
    industriesServed: (service.industriesServed ?? []).join(", "),
  })

  const [businessBenefits, setBusinessBenefits] = useState(JSON.stringify(service.businessBenefits ?? [], null, 2))
  const [technicalBenefits, setTechnicalBenefits] = useState(JSON.stringify(service.technicalBenefits ?? [], null, 2))
  const [workflow, setWorkflow] = useState(JSON.stringify(service.workflow ?? [], null, 2))
  const [useCases, setUseCases] = useState(JSON.stringify(service.useCases ?? [], null, 2))

  const [features, setFeatures] = useState<ServiceItem[]>(service.features ?? [])
  const [technologies, setTechnologies] = useState<ServiceItem[]>(service.technologies ?? [])
  const [faqs, setFaqs] = useState<ServiceItem[]>(service.faqs ?? [])
  const [portfolios, setPortfolios] = useState<ServiceItem[]>(service.portfolios ?? [])
  const [plans, setPlans] = useState<ServicePlan[]>(service.plans ?? [])
  const [addOns, setAddOns] = useState<ServiceAddon[]>(service.addOns ?? [])
  const [mediaAssets, setMediaAssets] = useState<ServiceMediaAsset[]>(service.mediaAssets ?? [])
  const [documents, setDocuments] = useState<ServiceDocument[]>(service.documents ?? [])

  const [featureDraft, setFeatureDraft] = useState({ ...emptyFeature })
  const [technologyDraft, setTechnologyDraft] = useState({ ...emptyTechnology })
  const [faqDraft, setFaqDraft] = useState({ ...emptyFaq })
  const [portfolioDraft, setPortfolioDraft] = useState({ ...emptyPortfolio })
  const [planDraft, setPlanDraft] = useState({ ...emptyPlan })
  const [addonDraft, setAddonDraft] = useState({ ...emptyAddon })
  const [mediaDraft, setMediaDraft] = useState({ ...emptyMedia })
  const [documentDraft, setDocumentDraft] = useState({ ...emptyDocument })

  const categoryLabel = useMemo(
    () => categories.find((cat) => cat.id === basic.categoryId)?.name ?? "Unassigned",
    [categories, basic.categoryId]
  )

  const apiRequest = async (method: "POST" | "PUT" | "DELETE", payload: any) => {
    const res = await fetch(`/api/admin/services/${service.id}/content`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Failed to save service content")
    return json.data
  }

  const handleBasicSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...basic,
        categoryId: basic.categoryId || null,
        heroImageUrl: basic.heroImageUrl || null,
        pricingGuidance: basic.pricingGuidance || null,
        seoTitle: basic.seoTitle || null,
        seoDescription: basic.seoDescription || null,
        businessBenefits: JSON.parse(businessBenefits),
        technicalBenefits: JSON.parse(technicalBenefits),
        workflow: JSON.parse(workflow),
        useCases: JSON.parse(useCases),
        industriesServed: basic.industriesServed.split(",").map((item) => item.trim()).filter(Boolean),
        seoKeywords: basic.seoKeywords.split(",").map((item) => item.trim()).filter(Boolean),
        isActive: Boolean(basic.isActive),
      }

      const res = await fetch(`/api/admin/services/${service.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error?.message || "Failed to update service")

      toast.success("Service updated successfully")
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Unable to update service")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this service page?")) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/services/${service.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Failed to delete")
      toast.success("Service deleted")
      router.push("/admin/services")
    } catch (error: any) {
      toast.error(error.message || "Unable to delete service")
      setLoading(false)
    }
  }

  const addItem = async (type: "feature" | "technology" | "faq" | "portfolio" | "plan" | "addon" | "media" | "document", draft: any) => {
    const data = await apiRequest("POST", { type, data: draft })
    if (type === "feature") setFeatures((prev) => [...prev, data])
    if (type === "technology") setTechnologies((prev) => [...prev, data])
    if (type === "faq") setFaqs((prev) => [...prev, data])
    if (type === "portfolio") setPortfolios((prev) => [...prev, data])
    if (type === "plan") setPlans((prev) => [...prev, data])
    if (type === "addon") setAddOns((prev) => [...prev, data])
    if (type === "media") setMediaAssets((prev) => [...prev, data])
    if (type === "document") setDocuments((prev) => [...prev, data])
  }

  const updateItem = async (type: "feature" | "technology" | "faq" | "portfolio" | "plan" | "addon" | "media" | "document", itemId: string, draft: any) => {
    const data = await apiRequest("PUT", { type, itemId, data: draft })
    if (type === "feature") setFeatures((prev) => prev.map((item) => (item.id === itemId ? data : item)))
    if (type === "technology") setTechnologies((prev) => prev.map((item) => (item.id === itemId ? data : item)))
    if (type === "faq") setFaqs((prev) => prev.map((item) => (item.id === itemId ? data : item)))
    if (type === "portfolio") setPortfolios((prev) => prev.map((item) => (item.id === itemId ? data : item)))
    if (type === "plan") setPlans((prev) => prev.map((item) => (item.id === itemId ? data : item)))
    if (type === "addon") setAddOns((prev) => prev.map((item) => (item.id === itemId ? data : item)))
    if (type === "media") setMediaAssets((prev) => prev.map((item) => (item.id === itemId ? data : item)))
    if (type === "document") setDocuments((prev) => prev.map((item) => (item.id === itemId ? data : item)))
  }

  const deleteItem = async (type: "feature" | "technology" | "faq" | "portfolio" | "plan" | "addon" | "media" | "document", itemId: string) => {
    if (!confirm("Delete this item?")) return
    await apiRequest("DELETE", { type, itemId })
    if (type === "feature") setFeatures((prev) => prev.filter((item) => item.id !== itemId))
    if (type === "technology") setTechnologies((prev) => prev.filter((item) => item.id !== itemId))
    if (type === "faq") setFaqs((prev) => prev.filter((item) => item.id !== itemId))
    if (type === "portfolio") setPortfolios((prev) => prev.filter((item) => item.id !== itemId))
    if (type === "plan") setPlans((prev) => prev.filter((item) => item.id !== itemId))
    if (type === "addon") setAddOns((prev) => prev.filter((item) => item.id !== itemId))
    if (type === "media") setMediaAssets((prev) => prev.filter((item) => item.id !== itemId))
    if (type === "document") setDocuments((prev) => prev.filter((item) => item.id !== itemId))
    toast.success("Item deleted")
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Edit Service: {service.title}</h1>
          <p className="text-gray-400 mt-1">Update service content, category, and nested CMS items.</p>
        </div>
        <button onClick={handleDelete} className="text-red-400 hover:text-red-300 transition">
          Delete Service
        </button>
      </div>

      <form onSubmit={handleBasicSubmit} className="space-y-6 bg-[#0f172a] border border-gray-800 p-6 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Basic Info</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
              <select
                value={basic.categoryId}
                onChange={(e) => setBasic((prev) => ({ ...prev, categoryId: e.target.value }))}
                className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">Unassigned</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">Current: {categoryLabel}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
              <input value={basic.title} onChange={(e) => setBasic((prev) => ({ ...prev, title: e.target.value }))} required className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Slug</label>
              <input value={basic.slug} onChange={(e) => setBasic((prev) => ({ ...prev, slug: e.target.value }))} required className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Hero Heading</label>
              <input value={basic.heroHeading} onChange={(e) => setBasic((prev) => ({ ...prev, heroHeading: e.target.value }))} required className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Hero Image URL</label>
              <input value={basic.heroImageUrl} onChange={(e) => setBasic((prev) => ({ ...prev, heroImageUrl: e.target.value }))} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
              <select value={String(basic.isActive)} onChange={(e) => setBasic((prev) => ({ ...prev, isActive: e.target.value === "true" }))} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white">
                <option value="false">Draft</option>
                <option value="true">Active</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Pricing Guidance</label>
              <input value={basic.pricingGuidance} onChange={(e) => setBasic((prev) => ({ ...prev, pricingGuidance: e.target.value }))} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="e.g. Starting from $5,000" />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Content</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Hero Subheading</label>
              <textarea value={basic.heroSubheading} onChange={(e) => setBasic((prev) => ({ ...prev, heroSubheading: e.target.value }))} required rows={3} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Overview</label>
              <textarea value={basic.overview} onChange={(e) => setBasic((prev) => ({ ...prev, overview: e.target.value }))} required rows={6} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Industries Served</label>
              <input value={basic.industriesServed} onChange={(e) => setBasic((prev) => ({ ...prev, industriesServed: e.target.value }))} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="Healthcare, Retail, Fintech" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">SEO Title</label>
              <input value={basic.seoTitle} onChange={(e) => setBasic((prev) => ({ ...prev, seoTitle: e.target.value }))} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">SEO Description</label>
              <textarea value={basic.seoDescription} onChange={(e) => setBasic((prev) => ({ ...prev, seoDescription: e.target.value }))} rows={3} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">SEO Keywords</label>
              <input value={basic.seoKeywords} onChange={(e) => setBasic((prev) => ({ ...prev, seoKeywords: e.target.value }))} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="ai consulting, saas development" />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-4">Advanced JSON Configurations</h2>
          <p className="text-sm text-gray-400 mb-4">Benefits, workflows, and use cases remain stored as JSON and are rendered on the public page.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Business Benefits</label>
              <textarea value={businessBenefits} onChange={(e) => setBusinessBenefits(e.target.value)} rows={6} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Technical Benefits</label>
              <textarea value={technicalBenefits} onChange={(e) => setTechnicalBenefits(e.target.value)} rows={6} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Workflow</label>
              <textarea value={workflow} onChange={(e) => setWorkflow(e.target.value)} rows={8} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Use Cases</label>
              <textarea value={useCases} onChange={(e) => setUseCases(e.target.value)} rows={8} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm" />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-800 flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/admin/services")} className="px-4 py-2 text-gray-400 hover:text-white transition">Back</button>
          <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <ContentEditor
          title="Service Features"
          description="Cards shown on the public service page."
          items={features}
          setItems={setFeatures}
          draft={featureDraft}
          setDraft={setFeatureDraft}
          onAdd={() => addItem("feature", featureDraft)}
          onUpdate={(id, item) => updateItem("feature", id, item)}
          onDelete={(id) => deleteItem("feature", id)}
        />
        <ContentEditor
          title="Technology Stack"
          description="Displayed as the service's implementation stack."
          items={technologies}
          setItems={setTechnologies}
          draft={technologyDraft}
          setDraft={setTechnologyDraft}
          onAdd={() => addItem("technology", technologyDraft)}
          onUpdate={(id, item) => updateItem("technology", id, item)}
          onDelete={(id) => deleteItem("technology", id)}
        />
        <ContentEditor
          title="FAQ"
          description="Frequently asked questions rendered on the public page."
          items={faqs}
          setItems={setFaqs}
          draft={faqDraft}
          setDraft={setFaqDraft}
          onAdd={() => addItem("faq", faqDraft)}
          onUpdate={(id, item) => updateItem("faq", id, item)}
          onDelete={(id) => deleteItem("faq", id)}
        />
        <ContentEditor
          title="Portfolio"
          description="Case studies and proof points for the service offering."
          items={portfolios}
          setItems={setPortfolios}
          draft={portfolioDraft}
          setDraft={setPortfolioDraft}
          onAdd={() => addItem("portfolio", portfolioDraft)}
          onUpdate={(id, item) => updateItem("portfolio", id, item)}
          onDelete={(id) => deleteItem("portfolio", id)}
        />
        <ContentEditor
          title="Plans"
          description="Subscription and one-time service pricing models."
          items={plans as any}
          setItems={setPlans as any}
          draft={planDraft}
          setDraft={setPlanDraft}
          onAdd={() => addItem("plan", planDraft)}
          onUpdate={(id, item) => updateItem("plan", id, item)}
          onDelete={(id) => deleteItem("plan", id)}
        />
        <ContentEditor
          title="Add-ons"
          description="Optional upgrades, bundles, and premium service extensions."
          items={addOns as any}
          setItems={setAddOns as any}
          draft={addonDraft}
          setDraft={setAddonDraft}
          onAdd={() => addItem("addon", addonDraft)}
          onUpdate={(id, item) => updateItem("addon", id, item)}
          onDelete={(id) => deleteItem("addon", id)}
        />
        <ContentEditor
          title="Media Assets"
          description="Screenshots, videos, demos, and preview assets."
          items={mediaAssets as any}
          setItems={setMediaAssets as any}
          draft={mediaDraft}
          setDraft={setMediaDraft}
          onAdd={() => addItem("media", mediaDraft)}
          onUpdate={(id, item) => updateItem("media", id, item)}
          onDelete={(id) => deleteItem("media", id)}
        />
        <ContentEditor
          title="Documents"
          description="Documentation, proposals, guides, and service terms."
          items={documents as any}
          setItems={setDocuments as any}
          draft={documentDraft}
          setDraft={setDocumentDraft}
          onAdd={() => addItem("document", documentDraft)}
          onUpdate={(id, item) => updateItem("document", id, item)}
          onDelete={(id) => deleteItem("document", id)}
        />
      </div>
    </div>
  )
}

function ContentEditor({
  title,
  description,
  items,
  setItems,
  draft,
  setDraft,
  onAdd,
  onUpdate,
  onDelete,
}: {
  title: string
  description: string
  items: ServiceItem[]
  setItems: Dispatch<SetStateAction<ServiceItem[]>>
  draft: any
  setDraft: Dispatch<SetStateAction<any>>
  onAdd: () => Promise<void>
  onUpdate: (id: string, item: any) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const draftLabel =
    title === "Service Features"
      ? "Add Feature"
      : title === "Technology Stack"
        ? "Add Technology"
        : title === "FAQ"
          ? "Add FAQ"
          : title === "Portfolio"
            ? "Add Portfolio Item"
            : title === "Plans"
              ? "Add Plan"
              : title === "Media Assets"
                ? "Add Media Asset"
                : title === "Documents"
                  ? "Add Document"
                  : "Add Add-on"

  return (
    <section className="rounded-2xl border border-gray-800 bg-[#0f172a] p-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>

      <div className="space-y-3">
        {title === "Service Features" && (
          <>
            <input value={draft.title} onChange={(e) => setDraft((prev: any) => ({ ...prev, title: e.target.value }))} placeholder="Feature title" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.icon} onChange={(e) => setDraft((prev: any) => ({ ...prev, icon: e.target.value }))} placeholder="Icon / emoji" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.description} onChange={(e) => setDraft((prev: any) => ({ ...prev, description: e.target.value }))} placeholder="Feature description" rows={3} className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.sortOrder} onChange={(e) => setDraft((prev: any) => ({ ...prev, sortOrder: Number(e.target.value) }))} type="number" placeholder="Sort order" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
          </>
        )}
        {title === "Technology Stack" && (
          <>
            <input value={draft.name} onChange={(e) => setDraft((prev: any) => ({ ...prev, name: e.target.value }))} placeholder="Technology name" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.iconUrl} onChange={(e) => setDraft((prev: any) => ({ ...prev, iconUrl: e.target.value }))} placeholder="Icon URL" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.sortOrder} onChange={(e) => setDraft((prev: any) => ({ ...prev, sortOrder: Number(e.target.value) }))} type="number" placeholder="Sort order" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
          </>
        )}
        {title === "FAQ" && (
          <>
            <input value={draft.question} onChange={(e) => setDraft((prev: any) => ({ ...prev, question: e.target.value }))} placeholder="Question" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.answer} onChange={(e) => setDraft((prev: any) => ({ ...prev, answer: e.target.value }))} placeholder="Answer" rows={4} className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.sortOrder} onChange={(e) => setDraft((prev: any) => ({ ...prev, sortOrder: Number(e.target.value) }))} type="number" placeholder="Sort order" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
          </>
        )}
        {title === "Portfolio" && (
          <>
            <input value={draft.title} onChange={(e) => setDraft((prev: any) => ({ ...prev, title: e.target.value }))} placeholder="Project title" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.imageUrl} onChange={(e) => setDraft((prev: any) => ({ ...prev, imageUrl: e.target.value }))} placeholder="Image URL" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.projectUrl} onChange={(e) => setDraft((prev: any) => ({ ...prev, projectUrl: e.target.value }))} placeholder="Project / demo URL" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.description} onChange={(e) => setDraft((prev: any) => ({ ...prev, description: e.target.value }))} placeholder="Project description" rows={4} className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.results} onChange={(e) => setDraft((prev: any) => ({ ...prev, results: e.target.value }))} placeholder="Results as JSON array or comma-separated list" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.sortOrder} onChange={(e) => setDraft((prev: any) => ({ ...prev, sortOrder: Number(e.target.value) }))} type="number" placeholder="Sort order" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
          </>
        )}
        {title === "Plans" && (
          <>
            <select value={draft.type} onChange={(e) => setDraft((prev: any) => ({ ...prev, type: e.target.value }))} className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white">
              <option value="SUBSCRIPTION">Subscription</option>
              <option value="ONE_TIME">One-time</option>
            </select>
            <input value={draft.name} onChange={(e) => setDraft((prev: any) => ({ ...prev, name: e.target.value }))} placeholder="Plan name" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.billingLabel} onChange={(e) => setDraft((prev: any) => ({ ...prev, billingLabel: e.target.value }))} placeholder="Billing label (e.g. 1 Month / Lifetime)" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.price} onChange={(e) => setDraft((prev: any) => ({ ...prev, price: Number(e.target.value) }))} type="number" step="0.01" placeholder="Price" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.currency} onChange={(e) => setDraft((prev: any) => ({ ...prev, currency: e.target.value }))} placeholder="Currency" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.description} onChange={(e) => setDraft((prev: any) => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Plan description" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.features} onChange={(e) => setDraft((prev: any) => ({ ...prev, features: e.target.value }))} rows={3} placeholder="Features JSON / comma-separated" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.isPopular} onChange={(e) => setDraft((prev: any) => ({ ...prev, isPopular: e.target.checked }))} /> Popular</label>
              <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((prev: any) => ({ ...prev, isActive: e.target.checked }))} /> Active</label>
            </div>
            <input value={draft.sortOrder} onChange={(e) => setDraft((prev: any) => ({ ...prev, sortOrder: Number(e.target.value) }))} type="number" placeholder="Sort order" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
          </>
        )}
        {title === "Add-ons" && (
          <>
            <input value={draft.name} onChange={(e) => setDraft((prev: any) => ({ ...prev, name: e.target.value }))} placeholder="Addon name" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.price} onChange={(e) => setDraft((prev: any) => ({ ...prev, price: Number(e.target.value) }))} type="number" step="0.01" placeholder="Price" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.currency} onChange={(e) => setDraft((prev: any) => ({ ...prev, currency: e.target.value }))} placeholder="Currency" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.description} onChange={(e) => setDraft((prev: any) => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Addon description" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft((prev: any) => ({ ...prev, enabled: e.target.checked }))} /> Enabled</label>
              <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.bundleOnly} onChange={(e) => setDraft((prev: any) => ({ ...prev, bundleOnly: e.target.checked }))} /> Bundle only</label>
              <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.restricted} onChange={(e) => setDraft((prev: any) => ({ ...prev, restricted: e.target.checked }))} /> Restricted</label>
              <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.isPopular} onChange={(e) => setDraft((prev: any) => ({ ...prev, isPopular: e.target.checked }))} /> Popular</label>
            </div>
            <input value={draft.sortOrder} onChange={(e) => setDraft((prev: any) => ({ ...prev, sortOrder: Number(e.target.value) }))} type="number" placeholder="Sort order" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
          </>
        )}
        {title === "Media Assets" && (
          <>
            <select value={draft.mediaType} onChange={(e) => setDraft((prev: any) => ({ ...prev, mediaType: e.target.value }))} className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white">
              <option value="SCREENSHOT">Screenshot</option>
              <option value="VIDEO">Video</option>
              <option value="DEMO">Demo</option>
              <option value="PREVIEW">Preview</option>
            </select>
            <input value={draft.title} onChange={(e) => setDraft((prev: any) => ({ ...prev, title: e.target.value }))} placeholder="Asset title" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.url} onChange={(e) => setDraft((prev: any) => ({ ...prev, url: e.target.value }))} placeholder="Asset URL" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.altText} onChange={(e) => setDraft((prev: any) => ({ ...prev, altText: e.target.value }))} placeholder="Alt text" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.caption} onChange={(e) => setDraft((prev: any) => ({ ...prev, caption: e.target.value }))} rows={3} placeholder="Caption" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.metadata} onChange={(e) => setDraft((prev: any) => ({ ...prev, metadata: e.target.value }))} rows={2} placeholder="Metadata JSON" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white font-mono text-xs" />
            <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((prev: any) => ({ ...prev, isActive: e.target.checked }))} /> Active</label>
          </>
        )}
        {title === "Documents" && (
          <>
            <select value={draft.documentType} onChange={(e) => setDraft((prev: any) => ({ ...prev, documentType: e.target.value }))} className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white">
              <option value="DOCUMENTATION">Documentation</option>
              <option value="PROPOSAL">Proposal</option>
              <option value="TERMS">Terms</option>
              <option value="GUIDE">Guide</option>
            </select>
            <input value={draft.title} onChange={(e) => setDraft((prev: any) => ({ ...prev, title: e.target.value }))} placeholder="Document title" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.slug} onChange={(e) => setDraft((prev: any) => ({ ...prev, slug: e.target.value }))} placeholder="document-slug" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.summary} onChange={(e) => setDraft((prev: any) => ({ ...prev, summary: e.target.value }))} rows={3} placeholder="Summary" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.content} onChange={(e) => setDraft((prev: any) => ({ ...prev, content: e.target.value }))} rows={5} placeholder="Content" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.previewUrl} onChange={(e) => setDraft((prev: any) => ({ ...prev, previewUrl: e.target.value }))} placeholder="Preview URL" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.demoUrl} onChange={(e) => setDraft((prev: any) => ({ ...prev, demoUrl: e.target.value }))} placeholder="Demo URL" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <input value={draft.version} onChange={(e) => setDraft((prev: any) => ({ ...prev, version: e.target.value }))} placeholder="Version" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white" />
            <textarea value={draft.metadata} onChange={(e) => setDraft((prev: any) => ({ ...prev, metadata: e.target.value }))} rows={2} placeholder="Metadata JSON" className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white font-mono text-xs" />
            <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.isPublished} onChange={(e) => setDraft((prev: any) => ({ ...prev, isPublished: e.target.checked }))} /> Published</label>
          </>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={async () => {
              try {
                await onAdd()
                setDraft(
                  title === "Service Features"
                    ? { ...emptyFeature }
                    : title === "Technology Stack"
                      ? { ...emptyTechnology }
                      : title === "FAQ"
                        ? { ...emptyFaq }
                        : title === "Portfolio"
                          ? { ...emptyPortfolio }
                          : title === "Plans"
                            ? { ...emptyPlan }
                            : title === "Media Assets"
                              ? { ...emptyMedia }
                              : title === "Documents"
                                ? { ...emptyDocument }
                                : { ...emptyAddon }
                )
                toast.success(draftLabel)
              } catch (error: any) {
                toast.error(error.message || "Unable to add item")
              }
            }}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {draftLabel}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
            {title === "Service Features" && (
              <>
                <input value={item.title ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, title: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.icon ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, icon: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <textarea value={item.description ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, description: e.target.value } : row))} rows={3} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
              </>
            )}
            {title === "Technology Stack" && (
              <>
                <input value={item.name ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, name: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.iconUrl ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, iconUrl: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
              </>
            )}
            {title === "FAQ" && (
              <>
                <input value={item.question ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, question: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <textarea value={item.answer ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, answer: e.target.value } : row))} rows={3} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
              </>
            )}
            {title === "Portfolio" && (
              <>
                <input value={item.title ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, title: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.imageUrl ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, imageUrl: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.projectUrl ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, projectUrl: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <textarea value={item.description ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, description: e.target.value } : row))} rows={3} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input
                  value={Array.isArray(item.results) ? JSON.stringify(item.results) : String(item.results ?? "")}
                  onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, results: e.target.value } : row))}
                  className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white"
                />
              </>
            )}
            {title === "Plans" && (
              <>
                <input value={item.type} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, type: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.name ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, name: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.billingLabel ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, billingLabel: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={String(item.price ?? 0)} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, price: Number(e.target.value) } : row))} type="number" step="0.01" className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.currency ?? "USD"} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, currency: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <textarea value={item.description ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, description: e.target.value } : row))} rows={3} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={Array.isArray(item.features) ? JSON.stringify(item.features) : String(item.features ?? "")} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, features: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(item.isPopular)} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, isPopular: e.target.checked } : row))} /> Popular</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(item.isActive)} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, isActive: e.target.checked } : row))} /> Active</label>
                </div>
              </>
            )}
            {title === "Add-ons" && (
              <>
                <input value={item.name ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, name: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={String(item.price ?? 0)} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, price: Number(e.target.value) } : row))} type="number" step="0.01" className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.currency ?? "USD"} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, currency: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <textarea value={item.description ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, description: e.target.value } : row))} rows={3} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(item.enabled)} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, enabled: e.target.checked } : row))} /> Enabled</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(item.bundleOnly)} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, bundleOnly: e.target.checked } : row))} /> Bundle only</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(item.restricted)} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, restricted: e.target.checked } : row))} /> Restricted</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(item.isPopular)} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, isPopular: e.target.checked } : row))} /> Popular</label>
                </div>
              </>
            )}
            {title === "Media Assets" && (
              <>
                <select value={item.mediaType} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, mediaType: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white">
                  <option value="SCREENSHOT">Screenshot</option>
                  <option value="VIDEO">Video</option>
                  <option value="DEMO">Demo</option>
                  <option value="PREVIEW">Preview</option>
                </select>
                <input value={item.title ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, title: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.url ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, url: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.altText ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, altText: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <textarea value={item.caption ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, caption: e.target.value } : row))} rows={3} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
              </>
            )}
            {title === "Documents" && (
              <>
                <select value={item.documentType} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, documentType: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white">
                  <option value="DOCUMENTATION">Documentation</option>
                  <option value="PROPOSAL">Proposal</option>
                  <option value="TERMS">Terms</option>
                  <option value="GUIDE">Guide</option>
                </select>
                <input value={item.title ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, title: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.slug ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, slug: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <textarea value={item.summary ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, summary: e.target.value } : row))} rows={3} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <textarea value={item.content ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, content: e.target.value } : row))} rows={5} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.previewUrl ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, previewUrl: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.demoUrl ?? ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, demoUrl: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
                <input value={item.version ?? "1.0"} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, version: e.target.value } : row))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white" />
              </>
            )}

            <div className="flex items-center justify-end gap-2">
              <input
                type="number"
                value={item.sortOrder ?? 0}
                onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, sortOrder: Number(e.target.value) } : row))}
                className="w-24 rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onUpdate(item.id, item)
                    toast.success("Item saved")
                  } catch (error: any) {
                    toast.error(error.message || "Unable to save item")
                  }
                }}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                Save
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onDelete(item.id)
                  } catch (error: any) {
                    toast.error(error.message || "Unable to delete item")
                  }
                }}
                className="rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-300 hover:text-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-500">No items yet.</p>}
      </div>
    </section>
  )
}
