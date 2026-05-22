"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ProjectsClient({ initialProjects }: { initialProjects: any[] }) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/dashboard/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          description: formData.get("description")
        }),
      })
      if (res.ok) {
        setModalOpen(false)
        const { data } = await res.json()
        setProjects(prev => [data, ...prev])
        router.refresh()
      } else {
        alert("Failed to request project")
      }
    } catch {
      alert("Error")
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "text-green-400 bg-green-400/10 border-green-400/20"
      case "COMPLETED": return "text-blue-400 bg-blue-400/10 border-blue-400/20"
      case "ON_HOLD": return "text-amber-400 bg-amber-400/10 border-amber-400/20"
      case "DRAFT": return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20"
      default: return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20"
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your requested and active projects.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="dash-btn px-4 py-2 rounded-lg text-sm font-medium transition-transform active:scale-95">
          Request Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <div className="col-span-full dash-glass p-12 text-center rounded-2xl">
            <span className="text-4xl">📋</span>
            <p className="mt-4 text-zinc-400">No projects yet. Request one to get started!</p>
          </div>
        ) : (
          projects.map(p => (
            <div key={p.id} className="dash-glass p-5 rounded-2xl border-white/5 hover:border-white/10 transition-all flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase ${getStatusColor(p.status)}`}>
                  {p.status}
                </span>
              </div>
              <h3 className="font-semibold text-lg line-clamp-1">{p.title}</h3>
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2 flex-1">{p.description}</p>
              <div className="mt-4 pt-4 border-t border-white/5 text-[11px] text-zinc-600 flex justify-between">
                <span>Updated: {new Date(p.updatedAt).toLocaleDateString()}</span>
                <button onClick={() => alert("Details coming soon")} className="text-purple-400 hover:underline">View Details</button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="dash-glass w-full max-w-md rounded-2xl p-6 dash-slide">
            <h2 className="text-xl font-bold mb-4">Request New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Project Title</label>
                <input name="title" required className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" placeholder="e.g. Website Redesign" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Description & Requirements</label>
                <textarea name="description" required rows={4} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" placeholder="Briefly describe what you need..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 dash-btn rounded-lg text-sm font-medium disabled:opacity-50">
                  {loading ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
