"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export interface Task {
  id: string
  title: string
  description?: string
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE"
  priority: "LOW" | "MEDIUM" | "HIGH"
  assignee?: string
  dueDate?: string | Date | null
}

interface KanbanBoardProps {
  initialTasks: Task[]
  onStatusChange?: (taskId: string, newStatus: Task["status"]) => Promise<void>
  onAddTask?: (title: string, status: Task["status"]) => Promise<Task | null>
}

const COLUMNS: { id: Task["status"]; label: string; color: string }[] = [
  { id: "TODO", label: "To Do", color: "text-zinc-600 bg-zinc-100" },
  { id: "IN_PROGRESS", label: "In Progress", color: "text-blue-600 bg-blue-100" },
  { id: "REVIEW", label: "Review", color: "text-amber-700 bg-amber-100" },
  { id: "DONE", label: "Done", color: "text-emerald-600 bg-emerald-100" },
]

const priorityColor: Record<string, string> = {
  HIGH: "bg-rose-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-zinc-300",
}

export function KanbanBoard({ initialTasks, onStatusChange, onAddTask }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [dragId, setDragId] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<Task["status"] | null>(null)
  const [newTitle, setNewTitle] = useState("")

  const handleDrop = async (status: Task["status"]) => {
    if (!dragId) return
    const prev = tasks
    setTasks((t) => t.map((task) => (task.id === dragId ? { ...task, status } : task)))
    setDragId(null)
    try {
      await onStatusChange?.(dragId, status)
    } catch {
      setTasks(prev) // rollback
    }
  }

  const handleAdd = async (status: Task["status"]) => {
    if (!newTitle.trim()) return
    const result = await onAddTask?.(newTitle.trim(), status)
    if (result) setTasks((t) => [...t, result])
    setNewTitle("")
    setAddingTo(null)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id)
        return (
          <div
            key={col.id}
            className="flex-shrink-0 w-64 flex flex-col bg-muted/20 rounded-xl border p-3 gap-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.id)}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${col.color}`}>
                {col.label}
              </span>
              <span className="text-xs text-muted-foreground bg-background border rounded-full px-2">
                {colTasks.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => setDragId(task.id)}
                  className="bg-background rounded-lg border p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-all shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${priorityColor[task.priority]}`}
                    />
                    <p className="font-medium text-sm leading-snug">{task.title}</p>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 ml-4 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  {task.dueDate && (
                    <p className="text-[10px] text-muted-foreground mt-2 ml-4">
                      Due {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {addingTo === col.id ? (
              <div className="flex flex-col gap-2">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd(col.id)}
                  placeholder="Task title..."
                  className="w-full px-2 py-1.5 text-xs border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleAdd(col.id)}>
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => { setAddingTo(null); setNewTitle("") }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground w-full border-dashed border"
                onClick={() => setAddingTo(col.id)}
              >
                + Add task
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
