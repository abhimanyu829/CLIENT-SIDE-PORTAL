"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Category = {
  id: string
  name: string
  slug: string
}

export default function NewServiceClient({ categories, initialCategoryId = "" }: { categories: Category[]; initialCategoryId?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null)
  const [businessBenefits, setBusinessBenefits] = useState("[]")
  const [technicalBenefits, setTechnicalBenefits] = useState("[]")
  const [workflow, setWorkflow] = useState("[]")
  const [useCases, setUseCases] = useState("[]")
  const [seoKeywords, setSeoKeywords] = useState("")
  const [industriesServed, setIndustriesServed] = useState("")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setFieldErrors(null)

    const formData = new FormData(e.currentTarget)

    // Parse JSON fields safely
    let parsedBusiness: any[] = []
    let parsedTechnical: any[] = []
    let parsedWorkflow: any[] = []
    let parsedUseCases: any[] = []
    try { parsedBusiness = JSON.parse(businessBenefits) } catch { toast.error("Business Benefits is not valid JSON"); setLoading(false); return }
    try { parsedTechnical = JSON.parse(technicalBenefits) } catch { toast.error("Technical Benefits is not valid JSON"); setLoading(false); return }
    try { parsedWorkflow = JSON.parse(workflow) } catch { toast.error("Workflow is not valid JSON"); setLoading(false); return }
    try { parsedUseCases = JSON.parse(useCases) } catch { toast.error("Use Cases is not valid JSON"); setLoading(false); return }

    const rawHeroImageUrl = (formData.get("heroImageUrl") as string | null) || ""

    const payload = {
      categoryId: (formData.get("categoryId") as string | null) || null,
      title: formData.get("title") as string,
      slug: formData.get("slug") as string,
      heroHeading: formData.get("heroHeading") as string,
      heroSubheading: formData.get("heroSubheading") as string,
      // only send heroImageUrl if it looks like a URL, otherwise send null
      heroImageUrl: rawHeroImageUrl.startsWith("http") ? rawHeroImageUrl : null,
      overview: formData.get("overview") as string,
      pricingGuidance: (formData.get("pricingGuidance") as string | null) || null,
      isActive: formData.get("isActive") === "true",
      businessBenefits: parsedBusiness,
      technicalBenefits: parsedTechnical,
      workflow: parsedWorkflow,
      useCases: parsedUseCases,
      industriesServed: industriesServed.split(",").map((item) => item.trim()).filter(Boolean),
      seoTitle: (formData.get("seoTitle") as string | null) || null,
      seoDescription: (formData.get("seoDescription") as string | null) || null,
      seoKeywords: seoKeywords.split(",").map((item) => item.trim()).filter(Boolean),
    }

    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.status === 422) {
        // Surface Zod field errors
        const fields = data.error?.details?.fieldErrors as Record<string, string[]> | undefined
        setFieldErrors(fields || null)
        const errorMsg = fields
          ? Object.entries(fields).map(([k, v]) => `${k}: ${v.join(", ")}`).join(" | ")
          : data.error?.message || "Validation failed"
        toast.error(`422 Validation Error — ${errorMsg}`)
        return
      }
      if (!res.ok) throw new Error(data.error?.message || "Failed to create service")

      toast.success("Service created successfully")
      router.push(`/admin/services/${data.data.id}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">New Service Page</h1>
        <p className="text-gray-400 mt-1">Create a new service offering landing page.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-[#0f172a] border border-gray-800 p-6 rounded-xl">
        {/* Field-level validation errors from 422 */}
        {fieldErrors && (
          <div className="bg-red-950/60 border border-red-700 rounded-lg p-4 text-sm">
            <p className="font-semibold text-red-400 mb-2">Validation errors — fix the following fields:</p>
            <ul className="space-y-1">
              {Object.entries(fieldErrors).map(([field, msgs]) => (
                <li key={field} className="text-red-300">
                  <span className="font-mono font-bold">{field}:</span> {msgs.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
            <select
              name="categoryId"
              defaultValue={initialCategoryId}
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Unassigned</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
            <input
              name="title"
              required
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. AI Agent Development"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Slug</label>
            <input
              name="slug"
              required
              pattern="^[a-z0-9-]+$"
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. ai-agent-development"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Hero Heading</label>
            <input
              name="heroHeading"
              required
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Main headline on the page"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Hero Subheading</label>
            <textarea
              name="heroSubheading"
              required
              rows={2}
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              placeholder="Supporting description below the headline"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Hero Image URL</label>
            <input
              name="heroImageUrl"
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Overview</label>
            <textarea
              name="overview"
              required
              rows={5}
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
              placeholder="Detailed overview of the service offering"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Pricing Guidance</label>
            <input
              name="pricingGuidance"
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. Starting at $5,000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Industries Served</label>
            <input
              value={industriesServed}
              onChange={(e) => setIndustriesServed(e.target.value)}
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="CRM, Healthcare, Logistics"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">SEO Title</label>
            <input
              name="seoTitle"
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">SEO Description</label>
            <textarea
              name="seoDescription"
              rows={2}
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">SEO Keywords</label>
            <input
              value={seoKeywords}
              onChange={(e) => setSeoKeywords(e.target.value)}
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="ai consulting, saas development, automation"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Business Benefits JSON</label>
              <textarea value={businessBenefits} onChange={(e) => setBusinessBenefits(e.target.value)} rows={6} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Technical Benefits JSON</label>
              <textarea value={technicalBenefits} onChange={(e) => setTechnicalBenefits(e.target.value)} rows={6} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Workflow JSON</label>
              <textarea value={workflow} onChange={(e) => setWorkflow(e.target.value)} rows={8} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Use Cases JSON</label>
              <textarea value={useCases} onChange={(e) => setUseCases(e.target.value)} rows={8} className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
            <select
              name="isActive"
              className="w-full bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="false">Draft (Hidden)</option>
              <option value="true">Active (Published)</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/services")}
            className="px-4 py-2 text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition"
          >
            {loading ? "Creating..." : "Create Service"}
          </button>
        </div>
      </form>
    </div>
  )
}
