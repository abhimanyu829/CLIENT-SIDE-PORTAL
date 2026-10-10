import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "API Documentation | Abhibhideveloper",
  description:
    "Verified API reference for Abhibhideveloper: public catalog and platform endpoints, authenticated customer endpoints, the platform-wide rate limiter, error formats, and the provider-facing webhook boundary.",
  alternates: { canonical: "/docs/api" },
}

function Endpoint({
  method,
  path,
  auth,
  description,
  params,
  example,
  response,
}: {
  method: string
  path: string
  auth: string
  description: string
  params?: Array<[string, string]>
  example?: string
  response?: string
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${method === "GET" ? "bg-emerald-500/15 text-emerald-300" : "bg-indigo-500/15 text-indigo-300"}`}>
          {method}
        </span>
        <code className="font-mono text-sm text-foreground">{path}</code>
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{auth}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      {params && params.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="py-1 pr-4">Parameter</th><th className="py-1">Description</th></tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {params.map(([p, d]) => (
                <tr key={p}><td className="py-1.5 pr-4 font-mono text-foreground">{p}</td><td className="py-1.5 text-muted-foreground">{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {example && (
        <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-background p-3 text-xs text-foreground"><code>{example}</code></pre>
      )}
      {response && (
        <>
          <p className="mt-3 text-xs font-medium text-muted-foreground">Example response (shape)</p>
          <pre className="mt-1 overflow-x-auto rounded-xl border border-border bg-background p-3 text-xs text-foreground"><code>{response}</code></pre>
        </>
      )}
    </article>
  )
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 pt-16 pb-4">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">Documentation</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">API documentation</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            This reference documents endpoints that exist in the running application. It intentionally does
            not list planned endpoints, and it does not publish administrative or customer-scoped endpoints
            as if they were public. Base URL: the origin you are reading this on (for production,
            <code className="mx-1 rounded bg-secondary px-1 py-0.5 font-mono text-xs">https://abhibhideveloper.tech</code>).
          </p>
          <nav className="mt-6 flex flex-wrap gap-2 text-xs">
            {[
              ["#authentication", "Authentication"],
              ["#public", "Public endpoints"],
              ["#ai", "AI endpoints"],
              ["#forms", "Forms"],
              ["#authenticated", "Authenticated endpoints"],
              ["#errors", "Errors"],
              ["#limits", "Rate limits"],
              ["#webhooks", "Webhooks"],
              ["#support", "Support"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:bg-accent/10">{label}</a>
            ))}
          </nav>
        </div>
      </section>

      <section id="authentication" className="px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Authentication</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            There is no public API-key programme today. Two authentication models exist in the running system:
          </p>
          <ul className="space-y-2 text-sm leading-7 text-muted-foreground">
            <li><strong className="text-foreground">Session authentication (customer and admin routes).</strong> Authenticated endpoints use the platform&apos;s session cookie established by the sign-in flow. Requests without a valid session are rejected with <code className="font-mono text-xs">401</code>; requests from an authenticated account without the required role or resource permission are rejected with <code className="font-mono text-xs">403</code>. Ownership is always derived on the server from the session — a client-supplied customer identifier is never accepted as proof of ownership.</li>
            <li><strong className="text-foreground">Machine identities (agent gateway).</strong> The agent-gateway surface authenticates machine connections with issued credentials. Every capability call is authorized server-side against the connection&apos;s permissions and requires approval where the capability is classified as high-risk. This surface is internal and is not documented here as a public API.</li>
          </ul>
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100">
            Never embed credentials, secrets, or API keys in frontend code or public repositories. Provider
            secrets used by this platform remain server-side and are never returned by any endpoint.
          </p>
        </div>
      </section>

      <section id="public" className="px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Public endpoints</h2>
          <p className="text-sm leading-7 text-muted-foreground">These endpoints do not require a session. They return published catalog and aggregate data only.</p>

          <Endpoint
            method="GET"
            path="/api/products"
            auth="Public"
            description="Lists published products from the marketplace catalog. Supports text search, category and type filtering, and pagination. Returns product summaries (name, slug, type, category, tags, starting price from the lowest tier) — never internal or unpublished records."
            params={[
              ["q", "Text search across product name and tags"],
              ["category", "Filter by product category"],
              ["type", "Filter by product type (for example SAAS, AI_AGENT, AUTOMATION, API)"],
              ["page / limit", "Pagination; limit is capped by the server"],
            ]}
            example={`curl "https://abhibhideveloper.tech/api/products?q=automation&page=1&limit=10"`}
            response={`{ "products": [ { "id": "...", "slug": "...", "name": "...", "type": "SAAS", "category": "...", "startingPrice": 1999 } ], "total": 12, "page": 1 }`}
          />

          <Endpoint
            method="GET"
            path="/api/search"
            auth="Public"
            description="Cross-catalog search used by the site search. Returns matching published products and services for the supplied query."
            params={[["q", "Search term"]]}
            example={`curl "https://abhibhideveloper.tech/api/search?q=chatbot"`}
          />

          <Endpoint
            method="GET"
            path="/api/platform-stats"
            auth="Public"
            description="Aggregate platform counters used for display (for example number of published products). Counts are derived from the live database; this endpoint does not expose customer data."
            example={`curl "https://abhibhideveloper.tech/api/platform-stats"`}
          />
        </div>
      </section>

      <section id="ai" className="px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">AI endpoints</h2>

          <Endpoint
            method="POST"
            path="/api/ai/chat"
            auth="Public (may require sign-in in some deployments)"
            description="Conversational endpoint used by the AI assistant experience. The response is streamed as plain-text chunks. If the server has no configured model provider key, the endpoint returns 503 with a clear 'not configured' message rather than pretending to answer. When a sessionId is supplied, the conversation is stored in the platform's Redis instance for that session; sessions without a sessionId are not persisted by this endpoint."
            params={[
              ["messages", "Array of chat messages: [{ role: 'user' | 'assistant', content: string }]"],
              ["sessionId", "Optional session identifier enabling per-session conversation storage in Redis"],
            ]}
            example={`curl -X POST https://abhibhideveloper.tech/api/ai/chat \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"What is a workflow automation agent?"}]}'`}
          />
          <p className="text-xs leading-6 text-muted-foreground">
            AI output can be inaccurate or incomplete and is not guaranteed. Do not rely on it for financial,
            legal, medical, employment, or security decisions. Malformed requests are rejected with 400; the
            endpoint is subject to the platform-wide rate limiter.
          </p>
        </div>
      </section>

      <section id="forms" className="px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Forms</h2>
          <Endpoint
            method="POST"
            path="/api/enquiries"
            auth="Public"
            description="Server-validated website enquiry intake used by the contact, enterprise, affiliate and press pages. Stores a lead record with a server-derived source label; the submitted category chooses the routing label. Includes a honeypot field, length limits, and a per-address throttle. No CRM data is returned to the caller."
            params={[
              ["name, email", "Required"],
              ["organization", "Optional"],
              ["category", "One of the published enquiry categories"],
              ["message", "10–4000 characters"],
              ["website", "Honeypot — must be empty"],
            ]}
            example={`curl -X POST https://abhibhideveloper.tech/api/enquiries \\
  -H "Content-Type: application/json" \\
  -d '{"name":"A","email":"a@example.com","category":"product-pricing","message":"Question about plan limits."}'`}
            response={`{ "ok": true }`}
          />
        </div>
      </section>

      <section id="authenticated" className="px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Authenticated endpoints (not public)</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            The application also exposes session-authenticated endpoints for customer and administrative
            functionality — for example dashboard data, cart and checkout, payments and invoices,
            subscriptions and entitlements, support tickets, and administrative operations. These are
            server-enforced and scoped to the authenticated account or role. They are intentionally not
            documented here as a public integration surface, and their exact request bodies may change as
            the product evolves. If you need an integration, use the{" "}
            <Link href="/contact" className="text-primary hover:underline underline-offset-4">enquiry form</Link>{" "}
            and describe your requirement.
          </p>
        </div>
      </section>

      <section id="errors" className="px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Errors</h2>
          <p className="text-sm leading-7 text-muted-foreground">Error responses use JSON with a human-readable message and an appropriate HTTP status. Internal details, stack traces, and secrets are never returned.</p>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Status</th><th className="px-4 py-3">Meaning</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["400", "Invalid input — missing or malformed fields"],
                  ["401", "Authentication required"],
                  ["403", "Authenticated but not permitted for this resource or action"],
                  ["404", "Resource not found (or not owned by the caller)"],
                  ["429", "Rate limit exceeded — retry later"],
                  ["503", "Required server configuration unavailable (for example the AI provider key)"],
                  ["500", "Unexpected server error — safe message only"],
                ].map(([code, meaning]) => (
                  <tr key={code}><td className="px-4 py-2.5 font-mono text-foreground">{code}</td><td className="px-4 py-2.5 text-muted-foreground">{meaning}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="limits" className="px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Rate limits & versioning</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            A platform-wide rate limiter is enforced at the edge for API traffic, and public forms and the AI
            endpoint apply additional throttling. Exact limits depend on the deployment configuration and are
            not published quantitatively here. There is no separately versioned public API today; endpoint
            paths may evolve while the platform is early-stage.
          </p>
        </div>
      </section>

      <section id="webhooks" className="px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Webhooks</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            The platform receives webhooks from payment and subscription providers. These endpoints are
            provider-facing, not a public integration surface: requests are verified against the provider&apos;s
            signature over the exact raw request body before anything is processed, and duplicate deliveries
            are handled idempotently. Webhook secrets remain server-side. The platform does not offer
            outbound customer webhooks today.
          </p>
        </div>
      </section>

      <section id="support" className="border-t border-border px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Testing & support</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            All public examples above use GET or idempotent, non-destructive requests. Never run examples
            against production with credentials you do not own. For integration questions, describe your use
            case through the <Link href="/contact" className="text-primary hover:underline underline-offset-4">contact form</Link>{" "}
            (category: custom software / AI automation) or check the{" "}
            <Link href="/faq" className="text-primary hover:underline underline-offset-4">FAQ</Link>.
          </p>
        </div>
      </section>
    </div>
  )
}