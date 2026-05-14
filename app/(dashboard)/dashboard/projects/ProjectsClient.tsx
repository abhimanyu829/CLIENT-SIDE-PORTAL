"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Project {
  id: string
  title: string
  status: string
  deadline: Date | null
}

export default function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const [view, setView] = useState<"grid" | "kanban">("grid")
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  
  const columns = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]

  return (
    <div className="space-y-8 relative min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your integrations and ongoing workflows.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted p-1 rounded-lg">
            <button 
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              onClick={() => setView("grid")}
            >
              Grid
            </button>
            <button 
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'kanban' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              onClick={() => setView("kanban")}
            >
              Kanban
            </button>
          </div>
          <Button>New Project</Button>
        </div>
      </div>

      {/* Grid View */}
      {view === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {initialProjects.map(proj => (
            <div 
              key={proj.id} 
              className="border rounded-xl bg-background shadow-sm p-6 space-y-4 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => setSelectedProject(proj)}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{proj.title}</h3>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">
                  {proj.status}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span>📅</span> {proj.deadline ? new Date(proj.deadline).toLocaleDateString() : 'No date'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kanban View */}
      {view === "kanban" && (
        <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-250px)]">
          {columns.map(col => (
            <div key={col} className="w-80 shrink-0 flex flex-col bg-muted/30 rounded-xl border p-4">
              <div className="font-semibold mb-4 text-sm flex justify-between">
                <span>{col}</span>
                <span className="bg-muted px-2 rounded-full">{initialProjects.filter(p => p.status === col).length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {initialProjects.filter(p => p.status === col).map(proj => (
                  <div 
                    key={proj.id} 
                    className="border rounded-lg bg-background p-4 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50"
                    onClick={() => setSelectedProject(proj)}
                  >
                    <h4 className="font-medium text-sm mb-2">{proj.title}</h4>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>{proj.deadline ? new Date(proj.deadline).toLocaleDateString() : 'No date'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-over Panel (Project Details) */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-background border-l h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-muted/10">
              <h2 className="text-xl font-bold truncate pr-4">{selectedProject.title}</h2>
              <button 
                onClick={() => setSelectedProject(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Status</p>
                  <p className="font-medium">{selectedProject.status}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Due Date</p>
                  <p className="font-medium">{selectedProject.deadline ? new Date(selectedProject.deadline).toLocaleDateString() : 'No date'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
