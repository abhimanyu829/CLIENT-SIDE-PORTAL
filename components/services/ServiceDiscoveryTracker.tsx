"use client"

import { useEffect } from "react"

export function ServiceDiscoveryTracker({ servicePageId }: { servicePageId: string }) {
  useEffect(() => {
    const key = "nexusai-service-discovery-session"
    const sessionKey = window.localStorage.getItem(key) || crypto.randomUUID()
    window.localStorage.setItem(key, sessionKey)
    void fetch("/api/service-discovery/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-discovery-session": sessionKey },
      body: JSON.stringify({ eventType: "VIEW", servicePageId }),
      keepalive: true,
    })
  }, [servicePageId])

  return null
}
