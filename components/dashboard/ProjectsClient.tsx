"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, FolderKanban, X } from "lucide-react"

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
      case "ACTIVE": return "text-emerald-700 bg-emerald-50 border-emerald-200 font-bold"
      case "COMPLETED": return "text-blue-700 bg-blue-50 border-blue-200 font-bold"
      case "ON_HOLD": return "text-amber-700 bg-amber-50 border-amber-200 font-bold"
      case "DRAFT": return "text-slate-600 bg-slate-100 border-slate-200 font-bold"
      default: return "text-slate-600 bg-slate-100 border-slate-200 font-bold"
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-600 font-medium mt-1">Manage your requested and active deliverables.</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)} 
          className="px-4 py-2.5 rounded-xl text-sm font-bold bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white transition-all shadow-sm hover:shadow-purple-500/25 flex items-center gap-2 hover:scale-[1.03] cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Request Project</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200/90 shadow-sm p-12 text-center rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 mx-auto flex items-center justify-center">
              <FolderKanban className="w-6 h-6" />
            </div>
            <p className="text-slate-900 font-bold text-base">No active projects found.</p>
            <p className="text-slate-500 text-xs max-w-sm mx-auto font-medium">Request a new project to start collaborating with our expert engineering team.</p>
          </div>
        ) : (
          projects.map(p => (
            <div key={p.id} className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${getStatusColor(p.status)}`}>
                    {p.status}
                  </span>
                </div>
                <h3 className="font-extrabold text-lg text-slate-900 line-clamp-1">{p.title}</h3>
                <p className="text-xs text-slate-600 font-medium mt-1 line-clamp-3 leading-relaxed">{p.description}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex justify-between items-center">
                <span>Updated: {new Date(p.updatedAt).toLocaleDateString()}</span>
                <span className="text-purple-600 font-bold hover:text-purple-700 cursor-pointer">View Details →</span>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 border border-slate-200 shadow-2xl text-slate-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-purple-600" />
                Request New Project
              </h2>
              <button 
                type="button" 
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Project Title</label>
                <input 
                  name="title" 
                  required 
                  className="w-full bg-white border border-slate-300 text-slate-900 font-medium placeholder:text-slate-400 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all" 
                  placeholder="e.g. Website Redesign" 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Description & Requirements</label>
                <textarea 
                  name="description" 
                  required 
                  rows={4} 
                  className="w-full bg-white border border-slate-300 text-slate-900 font-medium placeholder:text-slate-400 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all" 
                  placeholder="Briefly describe what you need..." 
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setModalOpen(false)} 
                  className="flex-1 py-2.5 px-4 text-sm font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl border border-slate-200/80 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 py-2.5 px-4 text-sm font-bold text-white hover:text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl border border-purple-500 shadow-sm transition-all hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
                >
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

