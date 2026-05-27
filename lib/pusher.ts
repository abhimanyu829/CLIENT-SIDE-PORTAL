import { env } from "@/lib/env"

// ── Pusher lazy initialization ────────────────────────────────────────────────
// Pusher is optional — if credentials are not configured, all trigger calls
// silently no-op. This prevents crashes from "dummy" keys or missing env vars.

let _pusherServer: any = null
let _pusherClient: any = null
let _pusherAvailable: boolean | null = null

function isPusherConfigured(): boolean {
  if (_pusherAvailable !== null) return _pusherAvailable
  _pusherAvailable = !!(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET && env.NEXT_PUBLIC_PUSHER_KEY && env.NEXT_PUBLIC_PUSHER_CLUSTER)
  if (!_pusherAvailable) {
    console.warn("[PUSHER] ⚠️ Pusher credentials not configured — realtime events will be skipped. Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER in .env to enable.")
  }
  return _pusherAvailable
}

// No-op Pusher server that silently skips all trigger calls
const noopServer = {
  trigger: async () => {
    // Pusher not configured — skipping realtime event
  },
}

// No-op Pusher client that silently skips all subscribe/bind calls
const noopClient = {
  subscribe: () => ({
    bind: () => {},
    unbind: () => {},
    unbind_all: () => {},
    unsubscribe: () => {},
  }),
  unsubscribe: () => {},
}

/**
 * Get the Pusher server instance.
 * Returns a no-op if Pusher is not configured.
 * Lazy-loads the `pusher` package to avoid import errors when not installed.
 */
export async function getPusherServer() {
  if (!isPusherConfigured()) return noopServer
  if (_pusherServer) return _pusherServer

  try {
    const PusherServer = (await import("pusher")).default
    _pusherServer = new PusherServer({
      appId: env.PUSHER_APP_ID!,
      key: env.NEXT_PUBLIC_PUSHER_KEY!,
      secret: env.PUSHER_SECRET!,
      cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      useTLS: true,
    })
    console.log("[PUSHER] ✅ Server instance initialized")
    return _pusherServer
  } catch (err) {
    console.error("[PUSHER] ❌ Failed to initialize Pusher server:", err)
    _pusherAvailable = false
    return noopServer
  }
}

// getPusherClient and pusherClient have been moved to @/lib/pusher-client.ts

// ── Synchronous exports for backward compatibility ────────────────────────────
// These use lazy initialization but fall back to no-op if not configured.
// Prefer using getPusherServer()/getPusherClient() for async code.

export const pusherServer = new Proxy({} as any, {
  get(_target, prop) {
    if (!isPusherConfigured()) return async () => {}
    // Lazy-init on first property access
    if (!_pusherServer) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const PusherServer = require("pusher")
        _pusherServer = new PusherServer({
          appId: env.PUSHER_APP_ID!,
          key: env.NEXT_PUBLIC_PUSHER_KEY!,
          secret: env.PUSHER_SECRET!,
          cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          useTLS: true,
        })
      } catch {
        _pusherAvailable = false
        return async () => {}
      }
    }
    const value = _pusherServer[prop]
    return typeof value === "function" ? value.bind(_pusherServer) : value
  },
})

// pusherClient proxy has been moved to @/lib/pusher-client.ts