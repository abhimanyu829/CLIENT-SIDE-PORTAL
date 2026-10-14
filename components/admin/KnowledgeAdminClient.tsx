"use client"
import { useState } from "react"

type Src = { id: string; title: string; canonicalUrl: string | null; status: string; publicationState: string; contentType: string; lastIngestedAt: string | null; category?: string | null; directContent?: string | null; version?: number }

export function KnowledgeAdminClient({ initial }: { initial: Src[] }) {
  const [rows, setRows] = useState<Src[]>(initial)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [content, setContent] = useState("")
  const [url, setUrl] = useState("")
  const [ctype, setCtype] = useState<"authoritative" | "page">("authoritative")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function refresh() {
    const r = await fetch("/api/admin/knowledge"); const j = await r.json(); if (j.sources) setRows(j.sources)
  }

  function resetForm() {
    setTitle(""); setContent(""); setUrl(""); setCategory(""); setEditingId(null)
  }

  function startEdit(s: Src) {
    setEditingId(s.id)
    setTitle(s.title)
    setCategory(s.category ?? "")
    setContent(s.directContent ?? "")
    setUrl(s.canonicalUrl ?? "")
    setCtype((s.contentType as "authoritative" | "page") ?? "authoritative")
    setMsg(null)
  }

  async function create() {
    setMsg(null)
    if (!title.trim() || (ctype === "authoritative" && !content.trim())) { setMsg("Title and content required for authoritative."); return }
    const body: Record<string, unknown> = { title: title.trim(), contentType: ctype, category: category.trim() || undefined, directContent: content.trim() || undefined, canonicalUrl: url.trim() || undefined }
    const r = await fetch("/api/admin/knowledge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const j = await r.json()
    if (!r.ok) { setMsg(j.error ?? "Create failed"); return }
    setMsg(`Created ${j.source.id} — ingest result: ${JSON.stringify(j.ingest ?? {})}`)
    resetForm()
    await refresh()
  }

  async function saveEdit() {
    if (!editingId) return
    setMsg(null)
    if (ctype === "authoritative" && !content.trim()) { setMsg("Approved content cannot be empty."); return }
    const body: Record<string, unknown> = { title: title.trim(), category: category.trim() || null, directContent: content.trim(), canonicalUrl: url.trim() || null }
    const r = await fetch(`/api/admin/knowledge?id=${encodeURIComponent(editingId)}&action=update`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const j = await r.json()
    if (!r.ok) { setMsg(j.error ?? "Update failed"); return }
    setMsg(`Updated ${editingId} — re-index: ${JSON.stringify(j.ingest ?? null)}`)
    resetForm()
    await refresh()
  }

  async function action(id: string, act: string) {
    const r = await fetch(`/api/admin/knowledge?id=${id}&action=${act}`, { method: "PATCH" })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) setMsg(j.error ?? act + " failed")
    else setMsg(`${act} ok: ${JSON.stringify(j)}`)
    await refresh()
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Knowledge Sources</h1>
        <p className="text-sm text-muted-foreground">P1 authoritative (admin-published) wins over P2 website content. Draft / unpublished / expired content is never returned to the chatbot.</p>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h2 className="font-medium text-sm">{editingId ? `Edit entry ${editingId}` : "Add entry"}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" className="border rounded px-2 py-1 text-sm" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g. pricing, policy)" className="border rounded px-2 py-1 text-sm" />
          <select value={ctype} onChange={(e) => setCtype(e.target.value as "authoritative" | "page")} disabled={!!editingId} className="border rounded px-2 py-1 text-sm">
            <option value="authoritative">authoritative (P1)</option>
            <option value="page">page (P2)</option>
          </select>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Canonical URL (optional)" className="border rounded px-2 py-1 text-sm" />
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Approved answer / information (required for authoritative). Treated as data, never as instructions." rows={4} className="w-full border rounded px-2 py-1 text-sm" />
        <div className="flex gap-2">
          {editingId ? (
            <>
              <button onClick={saveEdit} className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground">Save changes</button>
              <button onClick={resetForm} className="rounded border px-3 py-1.5 text-sm">Cancel</button>
            </>
          ) : (
            <button onClick={create} className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground">Create &amp; ingest</button>
          )}
          <button onClick={refresh} className="rounded border px-3 py-1.5 text-sm">Refresh</button>
        </div>
        {msg && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{msg}</p>}
      </div>

      <table className="w-full text-sm border">
        <thead><tr><th className="border p-2">Title</th><th className="border p-2">Type</th><th className="border p-2">State</th><th className="border p-2">Actions</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="border p-2"><div className="font-medium">{s.title}</div><div className="text-xs text-muted-foreground truncate max-w-[260px]">{s.canonicalUrl ?? (s as any).directContent?.slice(0, 80) ?? "-"}</div><div className="text-xs text-muted-foreground">{s.category ?? ""} · v{(s as any).version ?? 1}</div></td>
              <td className="border p-2">{s.contentType}</td>
              <td className="border p-2">{s.publicationState} / {s.status}</td>
              <td className="border p-2 flex flex-wrap gap-1">
                <button onClick={() => startEdit(s)} className="border rounded px-2 py-0.5 text-xs">Edit</button>
                <button onClick={() => action(s.id, "publish")} className="border rounded px-2 py-0.5 text-xs">Publish</button>
                <button onClick={() => action(s.id, "unpublish")} className="border rounded px-2 py-0.5 text-xs">Unpublish</button>
                <button onClick={() => action(s.id, "ingest")} className="border rounded px-2 py-0.5 text-xs">Re-ingest</button>
                <button onClick={() => action(s.id, "deactivate")} className="border rounded px-2 py-0.5 text-xs">Deactivate</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
