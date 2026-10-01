/**
 * lib/agent-gateway/tests/governance-test-kit.ts
 *
 * Shared harness for the Phase 10 suite (p10-*.test.ts).
 *
 * Everything security-relevant is REAL: lib/admin-auth.ts requireSuperAdmin()
 * / requireAdmin(), the Phase 7 requireHumanApprover(), the Phase 2
 * connection service, the Phase 6 policy engine + store, the Phase 7 gate and
 * autonomy store, the Phase 8 engine / worker, the Phase 9 trigger service /
 * runtime / webhook handler, every governance route and page module. Only the
 * session SOURCES are mocked (who is signed in: lib/auth + Clerk), plus Redis
 * (absent), SMS and the sub-admin credential session (which, to prove the
 * point, grants a sub-admin EVERY sub-admin permission).
 *
 * Data: the Phase 7 fake (connections, credentials, tasks, triggers, audit
 * log, ...) merged with the Phase 6 policy fake and the Phase 4 business
 * fake, one serialized snapshot/rollback transaction over all of them.
 */
import { vi } from "vitest"
import { createApprovalFakeDb, type FakeUser } from "./approval-fake-db"
import { createAuthzFakeDb } from "./authz-fake-db"
import { createExecutionFakeDb } from "./execution-fake-db"
import { InMemoryTaskQueue, TEST_CONFIG } from "./task-test-kit"
import { TRIGGER_TEST_CONFIG } from "./trigger-test-kit"
import type { AgentGatewayRequestContext } from "../shared/types"

export const SUPER = "admin_1"
export const SUPER_2 = "admin_2"
export const SUB = "sub_1"
export const PLAIN_USER = "user_1"
export const BANNED = "banned_1"

export interface RouteResult {
  status: number
  json: any
  text: string
  redirect?: string
  headers?: Headers
}

export function redirectTarget(err: unknown): string | null {
  const digest = (err as { digest?: unknown } | null)?.digest
  if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2] ?? null
  return null
}

export function isNotFoundError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest
  return typeof digest === "string" && (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404") || digest === "NEXT_NOT_FOUND")
}

export async function buildGovernanceKit() {
  vi.resetModules()
  const approval = createApprovalFakeDb()
  const authz = createAuthzFakeDb()
  const exec = createExecutionFakeDb()
  approval.seedConnection({ id: "conn_1", name: "Claude", ownerId: "owner_1" })
  approval.seedConnection({ id: "conn_2", name: "Other agent", ownerId: "owner_2" })
  const users: Array<[string, string, Partial<FakeUser>]> = [
    [SUPER, "SUPER_ADMIN", { phone: "+919999999999", phoneVerified: true }],
    [SUPER_2, "SUPER_ADMIN", { phone: "+919999999998", phoneVerified: true }],
    [SUB, "SUB_ADMIN", {}],
    [PLAIN_USER, "USER", {}],
    [BANNED, "SUPER_ADMIN", { isBanned: true }],
    ["owner_1", "USER", {}],
    ["owner_2", "USER", {}],
  ]
  for (const [id, role, extra] of users) {
    approval.seedUser({ phone: null, phoneVerified: false, isBanned: false, ...extra, id, role, name: id, email: `${id}@example.test` })
  }
  exec.seedProduct({ id: "prod_1", name: "Alpha", slug: "alpha", status: "AVAILABLE", type: "SAAS" })
  exec.seedProduct({ id: "prod_2", name: "Beta", slug: "beta", status: "AVAILABLE", type: "SAAS" })

  const merged: Record<string, unknown> = { ...exec.client, ...authz.client, ...approval.client }
  approval.setTransactionTarget(merged)
  approval.registerTransactionalTables(authz._policies as Map<string, unknown>, authz._versions as Map<string, unknown>)

  const session = { userId: SUPER as string | null, clerkSessionId: "sess_1" as string | null }
  const nav = { pathname: "/admin/agent-governance" }
  const requestHeaders = new Headers()

  const subadminPolicy = await import("@/lib/subadmin-permission-policy")
  const everyPermission = subadminPolicy.SUBADMIN_RESOURCES.flatMap((resource) => subadminPolicy.SUBADMIN_ACTIONS.map((action) => ({ resource, action })))

  vi.doMock("@/lib/db", () => ({ db: merged }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
  vi.doMock("@/lib/otp", () => ({ generateOtp: () => "123456" }))
  vi.doMock("@/lib/twilio", () => ({ sendSms: vi.fn(async () => true) }))
  vi.doMock("@/lib/auth", () => ({
    auth: vi.fn(async () => (session.userId ? { user: { id: session.userId, name: session.userId, email: `${session.userId}@example.test` } } : null)),
  }))
  vi.doMock("@clerk/nextjs/server", () => ({
    auth: vi.fn(async () => (session.userId && session.clerkSessionId ? { userId: `clerk_${session.userId}`, sessionId: session.clerkSessionId } : { userId: null, sessionId: null })),
  }))
  vi.doMock("@/lib/subadmin-workforce", () => ({
    validateSubadminCredentialSession: vi.fn(async () => ({ allowed: true, reason: null, permissions: everyPermission })),
  }))
  vi.doMock("next/headers", () => ({ headers: async () => requestHeaders, cookies: async () => new Map() }))
  vi.doMock("next/navigation", async () => {
    const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation")
    return {
      ...actual,
      useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
      usePathname: () => nav.pathname,
      useSearchParams: () => new URLSearchParams(),
    }
  })

  const { getCapabilityRegistry } = await import("../capabilities")
  const { getAdapterRegistry } = await import("../execution")
  const { ExecutionGate } = await import("../execution-gate/gate")
  const { PolicyEngineAuthorizer } = await import("../authorization/authorizer")
  const policyStore = await import("../authorization/policy-store")
  const autonomyStore = await import("../autonomy/policy-store")
  const { AgentTaskService } = await import("../tasks/engine")
  const { AgentTaskWorker } = await import("../tasks/worker")
  const { TaskQueueUnavailableError } = await import("../tasks/queue")
  const { TriggerService } = await import("../triggers/service")
  const { TriggerRuntime } = await import("../triggers/runtime")
  const { handleAgentWebhook } = await import("../triggers/webhook-handler")
  const secrets = await import("../triggers/secrets")
  const { AGENT_TASK_JOBS } = await import("@/lib/queue")
  const decisions = await import("../approvals/decision-service")
  const governance = await import("../governance")
  const { createMcpServerForRequest } = await import("../mcp/server")
  const { visibleCapabilities } = await import("../rollout/controls")
  const { buildAuthInfoExtra } = await import("../mcp/identity-context")
  const { getAgentConnectionService } = await import("../identity/connection-service")
  const React = await import("react")
  const { renderToStaticMarkup } = await import("react-dom/server")

  const registry = getCapabilityRegistry()
  const adapters = getAdapterRegistry()
  const gate = new ExecutionGate({ authorization: new PolicyEngineAuthorizer() })
  const queue = new InMemoryTaskQueue(TaskQueueUnavailableError)
  const taskService = new AgentTaskService({ capabilityRegistry: registry, adapterRegistry: adapters, gate, queue, config: TEST_CONFIG })
  const worker = new AgentTaskWorker({
    capabilityRegistry: registry,
    adapterRegistry: adapters,
    gate: new ExecutionGate({ authorization: new PolicyEngineAuthorizer() }),
    queue,
    config: TEST_CONFIG,
    environment: "development",
  })
  const triggerService = new TriggerService({ capabilityRegistry: registry, config: TRIGGER_TEST_CONFIG, environment: "development" })
  const runtime = new TriggerRuntime({ taskService, capabilityRegistry: registry, config: TRIGGER_TEST_CONFIG, environment: "development" })

  // Redis stand-ins with production semantics for the webhook endpoint.
  const usedNonces = new Set<string>()
  const webhookDeps = {
    enabled: () => true,
    maxBodyBytes: TRIGGER_TEST_CONFIG.webhookMaxBodyBytes,
    maxSkewSeconds: 300,
    rateLimiter: { check: async () => ({ allowed: true, limit: 60, remaining: 59, resetAt: new Date(Date.now() + 60_000) }) },
    consumeNonce: async (keyId: string, nonce: string) => {
      const key = `${keyId}:${nonce}`
      if (usedNonces.has(key)) return { ok: false as const, reason: "REPLAY_DETECTED" as const }
      usedNonces.add(key)
      return { ok: true as const }
    },
    runtime: () => runtime,
  }

  function as(userId: string | null, clerkSessionId: string | null = userId ? "sess_1" : null) {
    session.userId = userId
    session.clerkSessionId = clerkSessionId
  }

  /** Calls one exported handler of a REAL route module. */
  async function call(
    mod: Record<string, unknown>,
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    options: { path: string; body?: unknown; rawBody?: string; params?: Record<string, string>; headers?: Record<string, string>; contentType?: string | null } = { path: "/" }
  ): Promise<RouteResult> {
    const headers: Record<string, string> = { ...(options.contentType === null ? {} : { "content-type": options.contentType ?? "application/json" }), ...(options.headers ?? {}) }
    const init: RequestInit = { method, headers }
    if (options.rawBody !== undefined) init.body = options.rawBody
    else if (options.body !== undefined) init.body = JSON.stringify(options.body)
    const req = new Request(`https://abhibhi.test${options.path}`, init)
    const handler = mod[method] as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
    try {
      const res = await handler(req, { params: Promise.resolve(options.params ?? {}) })
      const text = await res.text()
      let json: any = null
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
      return { status: res.status, json, text, headers: res.headers }
    } catch (err) {
      const redirect = redirectTarget(err)
      if (redirect) return { status: 307, json: null, text: "", redirect }
      throw err
    }
  }

  /** Renders a REAL page (or layout) module to static HTML. */
  async function render(
    mod: { default: (props: any) => Promise<unknown> | unknown },
    options: { params?: Record<string, string>; searchParams?: Record<string, string>; pathname?: string; layout?: boolean } = {}
  ): Promise<{ html?: string; redirect?: string; notFound?: boolean }> {
    nav.pathname = options.pathname ?? "/admin/agent-governance"
    try {
      const props = options.layout
        ? { children: React.createElement("p", null, "page-content") }
        : { params: Promise.resolve(options.params ?? {}), searchParams: Promise.resolve(options.searchParams ?? {}) }
      const element = await mod.default(props)
      return { html: renderToStaticMarkup(element as React.ReactElement) }
    } catch (err) {
      const redirect = redirectTarget(err)
      if (redirect) return { redirect }
      if (isNotFoundError(err)) return { notFound: true }
      throw err
    }
  }

  async function drain(max = 50): Promise<number> {
    let processed = 0
    for (let i = 0; i < max; i += 1) {
      const job = queue.take()
      if (!job) break
      await worker.process({ name: AGENT_TASK_JOBS.EXECUTE, data: job.payload, id: job.jobId })
      processed += 1
    }
    return processed
  }

  function agentCtx(connectionId = "conn_1", ownerId = "owner_1"): AgentGatewayRequestContext {
    return {
      requestId: `req_${Math.random().toString(16).slice(2)}`,
      receivedAt: new Date(),
      authenticated: true,
      machine: { connectionId, credentialId: "cred_test", ownerId, connectionStatus: "ACTIVE", authenticatedAt: new Date() },
      connectionId,
      ownerId,
      protocol: "MCP",
      signal: new AbortController().signal,
    }
  }

  /** One JSON-RPC call through the REAL MCP server (Phase 5) with the task tools. */
  async function mcp(method: string, params: Record<string, unknown>, gatewayContext = agentCtx()) {
    const { WebStandardStreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js")
    // Phase 15: the tool surface is filtered by the release controls exactly as in mcp/route-handler.ts.
    const visibleCapabilityIds = await visibleCapabilities(gatewayContext.machine!.connectionId, "development", registry.list())
    const server = createMcpServerForRequest({ capabilityRegistry: registry, adapterRegistry: adapters, authorizer: gate, taskService, visibleCapabilityIds }, gatewayContext, "development")
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    try {
      const authInfo = { token: "", clientId: gatewayContext.machine!.connectionId, scopes: [], extra: buildAuthInfoExtra(gatewayContext, "development") }
      const res = await transport.handleRequest(
        new Request("https://abhibhi.test/api/agent-gateway/mcp", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        }),
        { authInfo }
      )
      return (await res.json()) as { result?: any; error?: any }
    } finally {
      await transport.close()
      await server.close()
    }
  }

  const tool = async (name: string, args: Record<string, unknown>, ctx = agentCtx()) => {
    const out = await mcp("tools/call", { name, arguments: args }, ctx)
    const text = out.result?.content?.[0]?.text ?? ""
    let parsed: any = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
    return { raw: out, text, json: parsed, isError: out.result?.isError === true }
  }

  /** Seeds a Phase 6 allow for a READ capability (as an administrator would). */
  const allowRead = (capabilityId: string) =>
    policyStore.createPolicyVersion({ name: `allow ${capabilityId}`, effect: "ALLOW", scope: "CAPABILITY", capabilityId, riskConstraint: "READ", actorId: SUPER })

  async function approve(publicRef: string, approver = SUPER) {
    const row = Array.from(approval._requests.values()).find((r) => r.publicRef === publicRef)!
    const human = { userId: approver, role: "SUPER_ADMIN", sessionReference: "sess_1" }
    await decisions.startApprovalStepUp(publicRef, human, new Date(), async () => true)
    await decisions.decideApproval({ publicRef, decision: "APPROVE", approver: human, confirmedBindingDigest: row.bindingDigest as string, stepUpCode: "123456" }, new Date())
  }

  /** A correctly signed Abhibhi webhook delivery. */
  function signedWebhook(ref: string, secret: string, body: Record<string, unknown>, eventId = `evt_${Math.random().toString(16).slice(2, 10)}`) {
    const text = JSON.stringify(body)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = `nonce-${Math.random().toString(36).slice(2)}-${Date.now()}`
    const path = `/api/agent-webhooks/${ref}`
    const signature = secrets.signWebhook(secret, { timestamp, nonce, eventId, method: "POST", path, body: text })
    return new Request(`https://abhibhi.test${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [secrets.WEBHOOK_HEADERS.timestamp]: timestamp,
        [secrets.WEBHOOK_HEADERS.nonce]: nonce,
        [secrets.WEBHOOK_HEADERS.eventId]: eventId,
        [secrets.WEBHOOK_HEADERS.signature]: signature,
      },
      body: text,
    })
  }

  const deliver = async (ref: string, req: Request) => {
    const res = await handleAgentWebhook(req, ref, webhookDeps)
    return { status: res.status, json: (await res.json()) as Record<string, unknown> }
  }

  /** Lets fire-and-forget audit writes (lib/audit.ts) settle. */
  const settle = () => new Promise((r) => setTimeout(r, 5))

  const auditEntries = () => Array.from(approval._auditLogs.values()) as Array<Record<string, any>>
  const taskRow = (ref: string) => Array.from(approval._tasks.values()).find((r) => r.taskRef === ref) as Record<string, any> | undefined
  const triggerRow = (ref: string) => Array.from(approval._triggers.values()).find((r) => r.publicRef === ref) as Record<string, any> | undefined

  return {
    approval,
    authz,
    exec,
    merged,
    session,
    requestHeaders,
    everyPermission,
    registry,
    adapters,
    gate,
    queue,
    taskService,
    worker,
    triggerService,
    runtime,
    webhookDeps,
    policyStore,
    autonomyStore,
    governance,
    secrets,
    AGENT_TASK_JOBS,
    connectionService: getAgentConnectionService,
    as,
    call,
    render,
    drain,
    agentCtx,
    mcp,
    tool,
    allowRead,
    approve,
    signedWebhook,
    deliver,
    settle,
    auditEntries,
    taskRow,
    triggerRow,
  }
}

export type GovernanceKit = Awaited<ReturnType<typeof buildGovernanceKit>>
