"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Category = {
  id: string
  slug: string
  name: string
  description?: string | null
  isActive: boolean
  sortOrder: number
  _count?: { services: number }
}

function emptyForm() {
  return { slug: "", name: "", description: "", sortOrder: 0, isActive: true }
}

export default function AdminServiceCategoriesClient({ initialCategories }: { initialCategories: Category[] }) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [form, setForm] = useState(emptyForm())
  const [loading, setLoading] = useState(false)

  const ordered = useMemo(() => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [categories])

  const submitCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/admin/service-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Failed to create category")
      setCategories((prev) => [json.data, ...prev])
      setForm(emptyForm())
      toast.success("Category created")
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Unable to create category")
    } finally {
      setLoading(false)
    }
  }

  const updateCategory = async (id: string, patch: Partial<Category>) => {
    const res = await fetch(`/api/admin/service-categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Failed to update category")
    setCategories((prev) => prev.map((item) => (item.id === id ? json.data : item)))
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this service category?")) return
    try {
      const res = await fetch(`/api/admin/service-categories/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Failed to delete category")
      setCategories((prev) => prev.filter((item) => item.id !== id))
      toast.success("Category deleted")
    } catch (error: any) {
      toast.error(error.message || "Unable to delete category")
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submitCreate} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Category name"
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
          />
          <input
            value={form.slug}
            onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
            placeholder="category-slug"
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
          />
          <input
            value={form.sortOrder}
            onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
            type="number"
            placeholder="Sort"
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
          />
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Active
          </label>
        </div>
        <textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Category description"
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white"
        />
        <div className="flex justify-end">
          <button disabled={loading} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? "Creating..." : "Create Category"}
          </button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((category) => (
          <div key={category.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <input
                  value={category.name}
                  onChange={(e) => setCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, name: e.target.value } : item))}
                  onBlur={(e) => updateCategory(category.id, { name: e.target.value })}
                  className="w-full bg-transparent text-lg font-semibold text-white outline-none"
                />
                <div className="mt-1 text-xs text-zinc-500">{category.slug}</div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${category.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"}`}>
                {category.isActive ? "Active" : "Draft"}
              </span>
            </div>
            <textarea
              value={category.description ?? ""}
              onChange={(e) => setCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, description: e.target.value } : item))}
              onBlur={(e) => updateCategory(category.id, { description: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <input
              value={category.sortOrder}
              onChange={(e) => setCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, sortOrder: Number(e.target.value) } : item))}
              onBlur={(e) => updateCategory(category.id, { sortOrder: Number(e.target.value) })}
              type="number"
              className="w-28 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{category._count?.services ?? 0} services</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateCategory(category.id, { isActive: !category.isActive })}
                  className="rounded-lg border border-white/10 px-3 py-1 text-zinc-300 hover:text-white"
                >
                  Toggle
                </button>
                <button onClick={() => handleDelete(category.id)} className="rounded-lg border border-red-500/20 px-3 py-1 text-red-300 hover:text-red-200">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {ordered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-zinc-400 md:col-span-2 xl:col-span-3">
            No service categories yet. Create the first category to organize the service CMS.
          </div>
        )}
      </div>
    </div>
  )
}
