/**
 * Phase 12 F — SSRF.
 *
 *   - there is no agent-reachable outbound request today (static scan of the
 *     gateway sources; no capability input accepts a URL);
 *   - the outbound guard refuses every classic SSRF payload at the URL
 *     level, classifies addresses correctly (IPv4, IPv6, mapped / NAT64 /
 *     6to4 forms, cloud metadata), checks DNS answers INSIDE the socket
 *     lookup (no rebinding window), never follows redirects, caps response
 *     size and times out.
 * The transport is exercised with an injected request function (no network).
 */
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"
import { EventEmitter } from "events"
import { PassThrough } from "stream"
import { describe, expect, it } from "vitest"
import {
  checkOutboundUrl,
  classifyAddress,
  createGuardedLookup,
  OutboundBlockedError,
  safeOutboundRequest,
  type OutboundDeps,
} from "../security/outbound-guard"
import { CORE_CAPABILITY_MANIFEST } from "../capabilities/manifest"
import { describeSchema } from "../capabilities/manifest-summary"

const POLICY = { allowedHosts: ["api.partner.example", "*.cdn.partner.example"] }

describe("Phase 12 F1 — URL checks refuse SSRF payloads", () => {
  it.each([
    ["http://api.partner.example/x", "SCHEME_NOT_ALLOWED"],
    ["file:///etc/passwd", "SCHEME_NOT_ALLOWED"],
    ["gopher://api.partner.example:70/_x", "SCHEME_NOT_ALLOWED"],
    ["ftp://api.partner.example/", "SCHEME_NOT_ALLOWED"],
    ["https://user:pass@api.partner.example/", "CREDENTIALS_IN_URL"],
    ["https://127.0.0.1/", "IP_LITERAL"],
    ["https://169.254.169.254/latest/meta-data/", "IP_LITERAL"],
    ["https://2130706433/", "IP_LITERAL"], // decimal 127.0.0.1
    ["https://0x7f000001/", "IP_LITERAL"], // hex
    ["https://017700000001/", "IP_LITERAL"], // octal
    ["https://127.1/", "IP_LITERAL"],
    ["https://[::1]/", "IP_LITERAL"],
    ["https://[::ffff:169.254.169.254]/", "IP_LITERAL"],
    ["https://localhost/", "LOCAL_HOSTNAME"],
    ["https://admin.localhost/", "LOCAL_HOSTNAME"],
    ["https://metadata.google.internal/computeMetadata/v1/", "LOCAL_HOSTNAME"],
    ["https://printer.local/", "LOCAL_HOSTNAME"],
    ["https://intranet/", "LOCAL_HOSTNAME"],
    ["https://api.partner.example:8443/", "PORT_NOT_ALLOWED"],
    ["https://evil.example/", "HOST_NOT_ALLOWLISTED"],
    ["https://api.partner.example.evil.example/", "HOST_NOT_ALLOWLISTED"],
    ["https://evilapi.partner.example/", "HOST_NOT_ALLOWLISTED"],
    ["https://cdn.partner.example/", "HOST_NOT_ALLOWLISTED"], // the wildcard covers subdomains only
    ["not a url", "INVALID_URL"],
    [`https://api.partner.example/${"a".repeat(3000)}`, "URL_TOO_LONG"],
  ])("%s -> %s", (url, reason) => {
    expect(checkOutboundUrl(url, POLICY)).toEqual({ ok: false, reason })
  })

  it("an empty allowlist allows nothing; allowlisted hosts (and a trailing dot / case variant) pass", () => {
    expect(checkOutboundUrl("https://api.partner.example/", { allowedHosts: [] })).toEqual({ ok: false, reason: "NO_ALLOWLIST" })
    for (const url of ["https://api.partner.example/v1?q=1", "https://API.Partner.Example./v1", "https://img.cdn.partner.example/a.png"]) {
      expect(checkOutboundUrl(url, POLICY).ok, url).toBe(true)
    }
  })
})

describe("Phase 12 F2 — address classification", () => {
  it.each([
    ["8.8.8.8", "PUBLIC"],
    ["93.184.216.34", "PUBLIC"],
    ["10.1.2.3", "PRIVATE"],
    ["172.16.0.1", "PRIVATE"],
    ["172.31.255.255", "PRIVATE"],
    ["172.32.0.1", "PUBLIC"],
    ["192.168.1.1", "PRIVATE"],
    ["127.0.0.1", "LOOPBACK"],
    ["169.254.169.254", "LINK_LOCAL"],
    ["100.64.0.1", "CGNAT"],
    ["0.0.0.0", "UNSPECIFIED"],
    ["224.0.0.1", "MULTICAST"],
    ["255.255.255.255", "BROADCAST"],
    ["240.0.0.1", "RESERVED"],
    ["192.0.2.1", "DOCUMENTATION"],
    ["198.18.0.1", "BENCHMARKING"],
    ["::1", "LOOPBACK"],
    ["::", "UNSPECIFIED"],
    ["::ffff:127.0.0.1", "LOOPBACK"],
    ["::ffff:7f00:1", "LOOPBACK"],
    ["::ffff:169.254.169.254", "LINK_LOCAL"],
    ["::ffff:8.8.8.8", "PUBLIC"],
    ["64:ff9b::a9fe:a9fe", "LINK_LOCAL"], // NAT64 of 169.254.169.254
    ["2002:7f00:0001::1", "RESERVED"], // 6to4 of 127.0.0.1
    ["fd00:ec2::254", "UNIQUE_LOCAL"], // AWS IMDS over IPv6
    ["fc00::1", "UNIQUE_LOCAL"],
    ["fe80::1%eth0", "LINK_LOCAL"],
    ["ff02::1", "MULTICAST"],
    ["2001:db8::1", "DOCUMENTATION"],
    ["2606:4700:4700::1111", "PUBLIC"],
    ["not-an-ip", "INVALID"],
  ])("%s is %s", (address, expected) => {
    expect(classifyAddress(address)).toBe(expected)
  })
})

describe("Phase 12 F3 — DNS answers are checked inside the socket lookup", () => {
  const resolver = (answers: Array<Array<{ address: string; family: number }>>) => {
    let call = 0
    return (_host: string, _opts: unknown, cb: (err: NodeJS.ErrnoException | null, addresses: Array<{ address: string; family: number }>) => void) => {
      const a = answers[Math.min(call, answers.length - 1)]
      call += 1
      cb(null, a)
    }
  }
  const lookupOnce = (lookup: ReturnType<typeof createGuardedLookup>, options: unknown = {}) =>
    new Promise<{ err: unknown; address: unknown; family?: number }>((resolve) => lookup("api.partner.example", options as never, (err, address, family) => resolve({ err, address, family })))

  it("a public answer is used; a private, mixed or metadata answer refuses the connection", async () => {
    expect(await lookupOnce(createGuardedLookup(resolver([[{ address: "93.184.216.34", family: 4 }]])))).toMatchObject({ err: null, address: "93.184.216.34", family: 4 })
    for (const answer of [
      [{ address: "10.0.0.5", family: 4 }],
      [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }],
      [{ address: "::ffff:169.254.169.254", family: 6 }],
      [{ address: "fd00:ec2::254", family: 6 }],
    ]) {
      const out = await lookupOnce(createGuardedLookup(resolver([answer])))
      expect(out.err).toBeInstanceOf(OutboundBlockedError)
      expect((out.err as OutboundBlockedError).reason).toBe("PRIVATE_ADDRESS")
    }
  })

  it("DNS rebinding: each connection checks the answer it actually uses (public first, private second -> second refused)", async () => {
    const lookup = createGuardedLookup(resolver([[{ address: "93.184.216.34", family: 4 }], [{ address: "127.0.0.1", family: 4 }]]))
    expect((await lookupOnce(lookup)).err).toBeNull()
    expect(((await lookupOnce(lookup)).err as OutboundBlockedError).reason).toBe("PRIVATE_ADDRESS")
  })

  it("honours the all:true form used by Happy Eyeballs, and fails closed on resolution errors", async () => {
    const all = await lookupOnce(createGuardedLookup(resolver([[{ address: "93.184.216.34", family: 4 }, { address: "2606:4700:4700::1111", family: 6 }]])), { all: true })
    expect(all.address).toHaveLength(2)
    const failing = createGuardedLookup((_h, _o, cb) => cb(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }), []))
    expect(((await lookupOnce(failing)).err as OutboundBlockedError).reason).toBe("DNS_FAILURE")
  })
})

describe("Phase 12 F4 — the transport", () => {
  function fakeTransport(script: { status?: number; headers?: Record<string, string>; chunks?: string[]; hang?: boolean }) {
    const captured: { options?: Record<string, any>; body?: string } = {}
    const request: OutboundDeps["request"] = ((options: Record<string, any>, onResponse: (res: any) => void) => {
      captured.options = options
      const req = new EventEmitter() as EventEmitter & { write: (c: string) => void; end: () => void; destroy: (e?: Error) => void }
      req.write = (c: string) => {
        captured.body = (captured.body ?? "") + c
      }
      req.destroy = () => undefined
      req.end = () => {
        if (script.hang) {
          setTimeout(() => req.emit("timeout"), 5)
          return
        }
        const res = new PassThrough() as PassThrough & { statusCode?: number; headers?: Record<string, string> }
        res.statusCode = script.status ?? 200
        res.headers = script.headers ?? { "content-type": "application/json" }
        onResponse(res)
        for (const c of script.chunks ?? ["{}"]) res.write(c)
        res.end()
      }
      return req
    }) as unknown as OutboundDeps["request"]
    return { request, captured, resolve: ((_h: string, _o: unknown, cb: (e: null, a: Array<{ address: string; family: number }>) => void) => cb(null, [{ address: "93.184.216.34", family: 4 }])) as OutboundDeps["resolve"] }
  }

  it("connects through the guarded lookup with a fresh agent, strips ambient credentials and returns allowlisted headers only", async () => {
    const t = fakeTransport({ headers: { "content-type": "application/json", "set-cookie": "s=1", server: "x" }, chunks: ['{"ok":true}'] })
    const res = await safeOutboundRequest("https://api.partner.example/v1/items?x=1", { method: "POST", headers: { cookie: "sid=1", host: "evil", "x-request-id": "r1" }, body: '{"a":1}' }, POLICY, t)
    expect(res).toEqual({ status: 200, headers: { "content-type": "application/json" }, body: '{"ok":true}' })
    expect(t.captured.options).toMatchObject({ protocol: "https:", hostname: "api.partner.example", servername: "api.partner.example", port: 443, path: "/v1/items?x=1", method: "POST", agent: false })
    expect(typeof t.captured.options!.lookup).toBe("function")
    expect(t.captured.options!.headers).toEqual({ "x-request-id": "r1", "content-length": "7" })
    expect(t.captured.body).toBe('{"a":1}')
  })

  it("never follows a redirect: the Location is returned for the caller to re-check", async () => {
    const t = fakeTransport({ status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" }, chunks: [""] })
    const res = await safeOutboundRequest("https://api.partner.example/r", {}, POLICY, t)
    expect(res.status).toBe(302)
    expect(res.location).toBe("https://169.254.169.254/latest/meta-data/")
    expect(checkOutboundUrl(res.location!, POLICY)).toEqual({ ok: false, reason: "IP_LITERAL" })
  })

  it("caps the response size and times out", async () => {
    const big = fakeTransport({ chunks: ["x".repeat(600), "x".repeat(600)] })
    await expect(safeOutboundRequest("https://api.partner.example/", { maxResponseBytes: 1000 }, POLICY, big)).rejects.toMatchObject({ reason: "RESPONSE_TOO_LARGE" })
    const slow = fakeTransport({ hang: true })
    await expect(safeOutboundRequest("https://api.partner.example/", { timeoutMs: 1 }, POLICY, slow)).rejects.toMatchObject({ reason: "TIMEOUT" })
  })

  it("a refused URL never reaches the transport", async () => {
    const t = fakeTransport({})
    await expect(safeOutboundRequest("https://169.254.169.254/", {}, POLICY, t)).rejects.toMatchObject({ code: "OUTBOUND_BLOCKED", reason: "IP_LITERAL" })
    expect(t.captured.options).toBeUndefined()
  })
})

describe("Phase 12 F5 — no agent-reachable outbound request exists", () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) return entry === "tests" ? [] : sources(full)
      return entry.endsWith(".ts") ? [full] : []
    })
  }

  it("no gateway module other than the outbound guard can make a network request", () => {
    const offenders: string[] = []
    for (const file of sources(path.resolve("lib/agent-gateway"))) {
      if (file.endsWith(path.join("security", "outbound-guard.ts"))) continue
      const text = readFileSync(file, "utf8")
      if (/\bfetch\s*\(|\bhttps?\.(?:request|get)\s*\(|from\s+["'](?:node:)?(?:https?|net|tls|dgram)["']|require\(["'](?:node:)?(?:https?|net|tls)["']\)|\baxios\b|node-fetch|\bundici\b|\bgot\s*\(/.test(text)) {
        offenders.push(path.relative(process.cwd(), file))
      }
    }
    expect(offenders).toEqual([])
  })

  it("no capability input accepts a URL, host or callback (nothing for an agent to point the platform at)", () => {
    const urlish = /url|uri|href|host|endpoint|callback|webhook|redirect/i
    const offenders: string[] = []
    const walk = (node: unknown, where: string) => {
      if (!node || typeof node !== "object") return
      const n = node as Record<string, unknown>
      if (Array.isArray(n.checks) && (n.checks as string[]).some((c) => c === "url" || c.startsWith("url:"))) offenders.push(where)
      if (n.fields && typeof n.fields === "object") {
        for (const [key, child] of Object.entries(n.fields as Record<string, unknown>)) {
          if (urlish.test(key)) offenders.push(`${where}.${key}`)
          walk(child, `${where}.${key}`)
        }
      }
      for (const k of ["optional", "nullable", "withDefault", "effects", "items", "values"]) if (n[k]) walk(n[k], where)
    }
    for (const def of CORE_CAPABILITY_MANIFEST) walk(describeSchema(def.inputSchema), def.id)
    expect(offenders).toEqual([])
  })

  it("the Phase 1 router still registers no destination", () => {
    const text = readFileSync(path.resolve("lib/agent-gateway/routing/backend-router.ts"), "utf8")
    expect(text).toMatch(/throw new GatewayError\(\s*"NOT_FOUND"/)
    const callers = sources(path.resolve("lib")).concat(sources(path.resolve("app"))).filter((f) => /\.register\(\s*["'`]/.test(readFileSync(f, "utf8")) && /ApprovedDestinationRouter/.test(readFileSync(f, "utf8")))
    expect(callers.map((f) => path.relative(process.cwd(), f))).toEqual([])
  })
})
