/**
 * lib/agent-gateway/security/outbound-guard.ts
 *
 * Phase 12 — SSRF defence for any outbound request made on an agent's
 * behalf.
 *
 * Today NO agent-reachable code path makes an outbound request: Phase 1's
 * router registers no destination, no capability accepts a URL, and the
 * webhook trigger is inbound only. A static test (p12-supply-chain) fails if
 * any gateway module other than this one calls fetch / http(s).request.
 * This module is the only sanctioned way to add one, and it is deny-by-
 * default:
 *
 *   URL      https only; no user:password@; port 443 unless allowlisted;
 *            no IP literals (decimal / octal / hex / IPv6 forms are
 *            normalised by the WHATWG parser first); no local / single-
 *            label / .local / .internal / .localhost hostnames; the host
 *            must be on a static, reviewed allowlist (exact or "*.domain").
 *   DNS      every resolved address must be public (private, loopback,
 *            link-local incl. 169.254.169.254, CGNAT, multicast, reserved,
 *            documentation, benchmarking, unique-local incl. fd00:ec2::254,
 *            IPv4-mapped / NAT64 / 6to4 forms of any of these). The check
 *            happens INSIDE the socket's lookup, so the address that was
 *            checked is the address connected to (no DNS-rebinding window).
 *   transport no redirects followed (the Location is returned for the caller
 *            to re-check), no ambient cookies, no proxy, fresh agent per
 *            request, timeout, response-size cap.
 */
import dns from "node:dns"
import https from "node:https"
import type { IncomingHttpHeaders, IncomingMessage } from "node:http"
import { isIP } from "node:net"

export type OutboundBlockReason =
  | "INVALID_URL"
  | "URL_TOO_LONG"
  | "SCHEME_NOT_ALLOWED"
  | "CREDENTIALS_IN_URL"
  | "PORT_NOT_ALLOWED"
  | "IP_LITERAL"
  | "LOCAL_HOSTNAME"
  | "NO_ALLOWLIST"
  | "HOST_NOT_ALLOWLISTED"
  | "PRIVATE_ADDRESS"
  | "DNS_FAILURE"
  | "TIMEOUT"
  | "RESPONSE_TOO_LARGE"
  | "REQUEST_FAILED"

export class OutboundBlockedError extends Error {
  readonly code = "OUTBOUND_BLOCKED" as const
  constructor(readonly reason: OutboundBlockReason) {
    super(`Outbound request refused (${reason}).`)
    this.name = "OutboundBlockedError"
  }
}

export interface OutboundPolicy {
  /** Exact hostnames or "*.example.com" (subdomains only). Empty = nothing allowed. */
  allowedHosts: readonly string[]
  /** Default [443]. */
  allowedPorts?: readonly number[]
  /** Default 2048. */
  maxUrlLength?: number
}

export type AddressClass =
  | "PUBLIC"
  | "PRIVATE"
  | "LOOPBACK"
  | "LINK_LOCAL"
  | "CGNAT"
  | "MULTICAST"
  | "RESERVED"
  | "UNSPECIFIED"
  | "DOCUMENTATION"
  | "BENCHMARKING"
  | "UNIQUE_LOCAL"
  | "BROADCAST"
  | "INVALID"

function parseIPv4(address: string): number[] | null {
  const parts = address.split(".")
  if (parts.length !== 4) return null
  const out: number[] = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const n = Number(p)
    if (n > 255) return null
    out.push(n)
  }
  return out
}

function classifyIPv4(o: number[]): AddressClass {
  const [a, b, c] = o
  if (a === 0) return "UNSPECIFIED"
  if (a === 10) return "PRIVATE"
  if (a === 100 && b >= 64 && b <= 127) return "CGNAT"
  if (a === 127) return "LOOPBACK"
  if (a === 169 && b === 254) return "LINK_LOCAL"
  if (a === 172 && b >= 16 && b <= 31) return "PRIVATE"
  if (a === 192 && b === 0 && c === 0) return "RESERVED"
  if (a === 192 && b === 0 && c === 2) return "DOCUMENTATION"
  if (a === 192 && b === 88 && c === 99) return "RESERVED"
  if (a === 192 && b === 168) return "PRIVATE"
  if (a === 198 && (b === 18 || b === 19)) return "BENCHMARKING"
  if (a === 198 && b === 51 && c === 100) return "DOCUMENTATION"
  if (a === 203 && b === 0 && c === 113) return "DOCUMENTATION"
  if (a >= 224 && a <= 239) return "MULTICAST"
  if (o.every((x) => x === 255)) return "BROADCAST"
  if (a >= 240) return "RESERVED"
  return "PUBLIC"
}

/** Expands an IPv6 address (optionally with an embedded dotted IPv4 tail) to 8 hextets. */
function parseIPv6(address: string): number[] | null {
  let text = address.toLowerCase()
  const zone = text.indexOf("%")
  if (zone !== -1) text = text.slice(0, zone)
  let tail: number[] = []
  const lastColon = text.lastIndexOf(":")
  const maybeV4 = text.slice(lastColon + 1)
  if (maybeV4.includes(".")) {
    const v4 = parseIPv4(maybeV4)
    if (!v4) return null
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]]
    text = text.slice(0, lastColon + 1) + "0:0"
  }
  const halves = text.split("::")
  if (halves.length > 2) return null
  const toHextets = (s: string) => (s === "" ? [] : s.split(":").map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN)))
  const head = toHextets(halves[0])
  const rest = halves.length === 2 ? toHextets(halves[1]) : []
  const missing = 8 - head.length - rest.length
  if (halves.length === 1 && missing !== 0) return null
  if (missing < 0) return null
  const all = [...head, ...new Array(halves.length === 2 ? missing : 0).fill(0), ...rest]
  if (all.length !== 8 || all.some((h) => Number.isNaN(h))) return null
  if (tail.length === 2) {
    all[6] = tail[0]
    all[7] = tail[1]
  }
  return all
}

function embeddedV4(h: number[], fromHextet: number): number[] {
  return [h[fromHextet] >> 8, h[fromHextet] & 0xff, h[fromHextet + 1] >> 8, h[fromHextet + 1] & 0xff]
}

function classifyIPv6(h: number[]): AddressClass {
  if (h.every((x) => x === 0)) return "UNSPECIFIED"
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return "LOOPBACK"
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) return classifyIPv4(embeddedV4(h, 6))
  if (h.slice(0, 6).every((x) => x === 0)) return "RESERVED"
  // NAT64 64:ff9b::/96 embeds an IPv4 address
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return classifyIPv4(embeddedV4(h, 6))
  if (h[0] === 0x64 && h[1] === 0xff9b) return "RESERVED"
  if (h[0] === 0x100 && h.slice(1, 4).every((x) => x === 0)) return "RESERVED" // discard prefix
  if (h[0] === 0x2001 && h[1] === 0x0db8) return "DOCUMENTATION"
  if (h[0] === 0x2001 && h[1] < 0x0200) return "RESERVED" // 2001::/23 IETF protocol assignments (incl. Teredo)
  if (h[0] === 0x2002) return classifyIPv4(embeddedV4(h, 1)) === "PUBLIC" ? "PUBLIC" : "RESERVED" // 6to4
  if ((h[0] & 0xfe00) === 0xfc00) return "UNIQUE_LOCAL"
  if ((h[0] & 0xffc0) === 0xfe80) return "LINK_LOCAL"
  if ((h[0] & 0xffc0) === 0xfec0) return "PRIVATE" // deprecated site-local
  if ((h[0] & 0xff00) === 0xff00) return "MULTICAST"
  if ((h[0] & 0xe000) !== 0x2000) return "RESERVED" // only 2000::/3 is global unicast
  return "PUBLIC"
}

export function classifyAddress(address: string): AddressClass {
  const family = isIP(address.includes("%") ? address.slice(0, address.indexOf("%")) : address)
  if (family === 4) {
    const v4 = parseIPv4(address)
    return v4 ? classifyIPv4(v4) : "INVALID"
  }
  if (family === 6) {
    const v6 = parseIPv6(address)
    return v6 ? classifyIPv6(v6) : "INVALID"
  }
  return "INVALID"
}

const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp"]

function hostAllowed(host: string, allowed: readonly string[]): boolean {
  for (const entry of allowed) {
    const rule = entry.toLowerCase().replace(/\.$/, "")
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(1) // ".example.com"
      if (host.endsWith(suffix) && host.length > suffix.length) return true
    } else if (host === rule) return true
  }
  return false
}

export type OutboundUrlCheck = { ok: true; url: URL; host: string; port: number } | { ok: false; reason: OutboundBlockReason }

export function checkOutboundUrl(rawUrl: unknown, policy: OutboundPolicy): OutboundUrlCheck {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return { ok: false, reason: "INVALID_URL" }
  if (rawUrl.length > (policy.maxUrlLength ?? 2048)) return { ok: false, reason: "URL_TOO_LONG" }
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: "INVALID_URL" }
  }
  if (url.protocol !== "https:") return { ok: false, reason: "SCHEME_NOT_ALLOWED" }
  if (url.username || url.password) return { ok: false, reason: "CREDENTIALS_IN_URL" }
  const hostname = url.hostname.toLowerCase()
  const bare = (hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname).replace(/\.$/, "")
  if (isIP(bare)) return { ok: false, reason: "IP_LITERAL" }
  if (!bare.includes(".") || bare === "localhost" || LOCAL_SUFFIXES.some((s) => bare.endsWith(s))) return { ok: false, reason: "LOCAL_HOSTNAME" }
  const port = url.port ? Number(url.port) : 443
  if (!(policy.allowedPorts ?? [443]).includes(port)) return { ok: false, reason: "PORT_NOT_ALLOWED" }
  if (policy.allowedHosts.length === 0) return { ok: false, reason: "NO_ALLOWLIST" }
  if (!hostAllowed(bare, policy.allowedHosts)) return { ok: false, reason: "HOST_NOT_ALLOWLISTED" }
  return { ok: true, url, host: bare, port }
}

type LookupResolver = (hostname: string, options: dns.LookupAllOptions, callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) => void

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void

/**
 * A `lookup` for net / https: resolves every address and refuses the
 * connection unless ALL of them are public. The socket connects to an
 * address from this same answer, so check and use cannot diverge.
 */
export function createGuardedLookup(resolve: LookupResolver = dns.lookup as unknown as LookupResolver) {
  return (hostname: string, options: dns.LookupOptions | number | undefined, callback: LookupCallback): void => {
    const wantAll = typeof options === "object" && options !== null && options.all === true
    resolve(hostname, { all: true }, (err, addresses) => {
      if (err || !Array.isArray(addresses) || addresses.length === 0) {
        callback(new OutboundBlockedError("DNS_FAILURE") as unknown as NodeJS.ErrnoException, "")
        return
      }
      if (addresses.some((a) => classifyAddress(a.address) !== "PUBLIC")) {
        callback(new OutboundBlockedError("PRIVATE_ADDRESS") as unknown as NodeJS.ErrnoException, "")
        return
      }
      if (wantAll) callback(null, addresses)
      else callback(null, addresses[0].address, addresses[0].family)
    })
  }
}

export interface OutboundRequest {
  method?: "GET" | "POST"
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  maxResponseBytes?: number
}

export interface OutboundResponse {
  status: number
  headers: Record<string, string>
  body: string
  /** Set for 3xx responses. Redirects are never followed: re-check before any follow-up request. */
  location?: string
}

export interface OutboundDeps {
  request: (options: https.RequestOptions, callback: (res: IncomingMessage) => void) => ReturnType<typeof https.request>
  resolve: LookupResolver
}

const DEFAULT_OUTBOUND_DEPS: OutboundDeps = { request: https.request, resolve: dns.lookup as unknown as LookupResolver }
const FORBIDDEN_REQUEST_HEADERS = new Set(["host", "cookie", "proxy-authorization", "proxy-connection", "connection", "transfer-encoding", "upgrade"])
const RETURNED_RESPONSE_HEADERS = ["content-type", "content-length", "retry-after", "location", "etag", "last-modified"]

function pickHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of RETURNED_RESPONSE_HEADERS) {
    const v = headers[name]
    if (typeof v === "string") out[name] = v
  }
  return out
}

/** The only sanctioned outbound request for agent-driven work. Throws OutboundBlockedError on any refusal. */
export function safeOutboundRequest(rawUrl: string, req: OutboundRequest, policy: OutboundPolicy, deps: OutboundDeps = DEFAULT_OUTBOUND_DEPS): Promise<OutboundResponse> {
  const check = checkOutboundUrl(rawUrl, policy)
  if (!check.ok) return Promise.reject(new OutboundBlockedError(check.reason))
  const maxBytes = req.maxResponseBytes ?? 1024 * 1024
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    if (!FORBIDDEN_REQUEST_HEADERS.has(name.toLowerCase())) headers[name] = value
  }
  if (req.body !== undefined) headers["content-length"] = String(Buffer.byteLength(req.body, "utf8"))

  return new Promise<OutboundResponse>((resolve, reject) => {
    let settled = false
    const fail = (err: unknown) => {
      if (settled) return
      settled = true
      reject(err instanceof OutboundBlockedError ? err : new OutboundBlockedError("REQUEST_FAILED"))
    }
    const request = deps.request(
      {
        protocol: "https:",
        hostname: check.host,
        servername: check.host,
        port: check.port,
        path: `${check.url.pathname}${check.url.search}`,
        method: req.method ?? "GET",
        headers,
        lookup: createGuardedLookup(deps.resolve) as unknown as https.RequestOptions["lookup"],
        agent: false,
        timeout: req.timeoutMs ?? 5_000,
      },
      (res) => {
        const chunks: Buffer[] = []
        let size = 0
        res.on("data", (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) {
            request.destroy(new OutboundBlockedError("RESPONSE_TOO_LARGE"))
            fail(new OutboundBlockedError("RESPONSE_TOO_LARGE"))
            return
          }
          chunks.push(chunk)
        })
        res.on("end", () => {
          if (settled) return
          settled = true
          const status = res.statusCode ?? 0
          const out: OutboundResponse = { status, headers: pickHeaders(res.headers), body: Buffer.concat(chunks).toString("utf8") }
          if (status >= 300 && status < 400 && typeof res.headers.location === "string") out.location = res.headers.location
          resolve(out)
        })
        res.on("error", fail)
      }
    )
    request.on("timeout", () => {
      request.destroy(new OutboundBlockedError("TIMEOUT"))
      fail(new OutboundBlockedError("TIMEOUT"))
    })
    request.on("error", fail)
    if (req.body !== undefined) request.write(req.body)
    request.end()
  })
}
