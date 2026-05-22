"use client"

import { useState, useEffect } from "react"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  duration?: number
}

type ToastListener = (toasts: Toast[]) => void
let listeners: ToastListener[] = []
let memoryToasts: Toast[] = []

function emit() {
  listeners.forEach((listener) => {
    listener([...memoryToasts])
  })
}

export function toast(options: Omit<Toast, "id">) {
  const id = Math.random().toString(36).substring(2, 9)
  const newToast: Toast = { id, ...options }
  memoryToasts.push(newToast)
  emit()

  if (options.duration !== Infinity) {
    setTimeout(() => {
      dismiss(id)
    }, options.duration || 4000)
  }

  return id
}

function dismiss(id: string) {
  memoryToasts = memoryToasts.filter((t) => t.id !== id)
  emit()
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    listeners.push(setToasts)
    setToasts(memoryToasts)
    return () => {
      listeners = listeners.filter((listener) => listener !== setToasts)
    }
  }, [])

  return {
    toasts,
    toast,
    dismiss,
  }
}
