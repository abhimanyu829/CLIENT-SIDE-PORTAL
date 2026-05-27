// ── Pusher Client (Browser Safe) ──────────────────────────────────────────────
// Lazy initialization of Pusher client to prevent server-side secrets from leaking
// and to avoid crashing client components.

let _pusherClient: any = null
let _pusherAvailable: boolean | null = null

function isPusherConfigured(): boolean {
  if (_pusherAvailable !== null) return _pusherAvailable
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  _pusherAvailable = !!(key && cluster)
  if (!_pusherAvailable) {
    console.warn("[PUSHER] ⚠️ Pusher public credentials not configured — realtime events will be skipped on client.")
  }
  return _pusherAvailable
}

const noopClient = {
  subscribe: () => ({
    bind: () => {},
    unbind: () => {},
    unbind_all: () => {},
    unsubscribe: () => {},
  }),
  unsubscribe: () => {},
}

export async function getPusherClient() {
  if (!isPusherConfigured()) return noopClient
  if (_pusherClient) return _pusherClient

  try {
    const PusherClient = (await import("pusher-js")).default
    _pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    })
    console.log("[PUSHER] ✅ Client instance initialized")
    return _pusherClient
  } catch (err) {
    console.error("[PUSHER] ❌ Failed to initialize Pusher client:", err)
    _pusherAvailable = false
    return noopClient
  }
}

export const pusherClient = new Proxy({} as any, {
  get(_target, prop) {
    if (!isPusherConfigured()) {
      if (prop === "subscribe") return () => ({ bind: () => {}, unbind: () => {}, unbind_all: () => {}, unsubscribe: () => {} })
      if (prop === "unsubscribe") return () => {}
      return () => {}
    }
    if (!_pusherClient) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const PusherClient = require("pusher-js")
        _pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          authEndpoint: "/api/pusher/auth",
        })
      } catch {
        _pusherAvailable = false
        if (prop === "subscribe") return () => ({ bind: () => {}, unbind: () => {}, unbind_all: () => {}, unsubscribe: () => {} })
        if (prop === "unsubscribe") return () => {}
        return () => {}
      }
    }
    const value = _pusherClient[prop]
    return typeof value === "function" ? value.bind(_pusherClient) : value
  },
})
