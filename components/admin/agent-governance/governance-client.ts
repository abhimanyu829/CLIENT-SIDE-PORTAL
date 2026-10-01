/**
 * components/admin/agent-governance/governance-client.ts
 *
 * Browser-side helper for the governance mutation routes: always JSON (the
 * routes reject anything else), never caches, and turns the stable error
 * codes into distinct, human messages (conflict vs validation vs forbidden
 * vs unavailable).
 */
export interface GovernanceResult<T = Record<string, unknown>> {
  ok: boolean
  status: number
  code?: string
  error?: string
  data?: T
}

export async function sendGovernance<T = Record<string, unknown>>(url: string, init: { method?: "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {}): Promise<GovernanceResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: init.body === undefined ? (init.method === "DELETE" ? undefined : "{}") : JSON.stringify(init.body),
      cache: "no-store",
    })
    // A redirect to /login or /unauthorized (expired session, lost role) is not JSON.
    const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { success?: boolean; code?: string; error?: string }) | null
    if (!json) return { ok: false, status: res.status, code: "UNEXPECTED_RESPONSE", error: "Your session may have expired. Reload the page and sign in again." }
    if (!res.ok || json.success === false) return { ok: false, status: res.status, code: json.code, error: json.error }
    return { ok: true, status: res.status, data: json as T }
  } catch {
    return { ok: false, status: 0, code: "NETWORK_ERROR", error: "The request could not be sent. Check your connection and try again." }
  }
}

export function describeFailure(result: GovernanceResult<unknown>): { title: string; description: string } {
  switch (true) {
    case result.status === 409 && result.code === "CONFLICT":
      return { title: "Changed by someone else", description: "This item changed since you loaded the page. The page has been refreshed; review it and try again." }
    case result.status === 409:
      return { title: "Not allowed in the current state", description: result.error ?? "The item is no longer in a state that allows this action." }
    case result.status === 400:
      return { title: "Check the form", description: result.error ?? "Some values are not valid." }
    case result.status === 401 || result.status === 403:
      return { title: "Not authorized", description: result.error ?? "Only super administrators with a live session can do this." }
    case result.status === 404:
      return { title: "Not found", description: result.error ?? "It may have been removed." }
    case result.status === 503 || result.status === 0:
      return { title: "Temporarily unavailable", description: result.error ?? "A dependency is unavailable. Nothing was changed; try again shortly." }
    default:
      return { title: "Action failed", description: result.error ?? "The request could not be completed." }
  }
}
