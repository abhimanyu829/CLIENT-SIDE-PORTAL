import type { Metadata } from "next"
import Link from "next/link"
import { AiAgentDemo } from "@/components/demo/AiAgentDemo"

export const metadata: Metadata = {
  title: "AI Agent Demonstration | Abhibhideveloper",
  description:
    "Interact with a live AI assistant demonstration backed by the platform's real server-side endpoint, and read an honest explanation of what the agent can and cannot do.",
  alternates: { canonical: "/demo/ai-agent" },
}

export default function AiAgentDemoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 pt-16 pb-4">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">Demo · AI Agent</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">AI assistant demonstration</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            An AI agent accepts a natural-language request and produces a response using a language model. In
            a business setting, agents are useful for high-volume, text-heavy work: answering questions from an
            approved knowledge base, summarising threads, classifying requests, and drafting first responses
            for human review.
          </p>
        </div>
      </section>

      <section className="px-4 pb-6">
        <div className="mx-auto max-w-4xl">
          <AiAgentDemo />
        </div>
      </section>

      <section className="px-4 py-8">
        <div className="mx-auto max-w-4xl grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h2 className="text-base font-semibold">What this demonstration does</h2>
            <ul className="mt-2 space-y-1.5 leading-6 text-muted-foreground">
              <li>Uses the platform&apos;s real server-side endpoint, so a model must actually be configured to answer.</li>
              <li>Streams the response as it is produced.</li>
              <li>Shows an explicit unavailable state when the deployment has no model key — it does not fake replies.</li>
              <li>Keeps provider keys on the server; the browser never receives credentials.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h2 className="text-base font-semibold">What it does not do</h2>
            <ul className="mt-2 space-y-1.5 leading-6 text-muted-foreground">
              <li>No browsing of the live web, no autonomous tool execution, no external actions.</li>
              <li>No persistent memory in this demo — no session id is sent, so conversations are not saved by the endpoint.</li>
              <li>No guarantees of accuracy. Output must be reviewed, especially for financial, legal, medical, employment, or security decisions.</li>
              <li>No voice, image, or file input in this demo.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-10">
        <div className="mx-auto max-w-4xl text-sm leading-7 text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">Building with AI agents</h2>
          <p className="mt-2">
            A production agent usually needs grounding in your own documents, explicit scope limits, a review
            step for consequential outcomes, and cost controls. If you want to explore that for your business,{" "}
            <Link href="/contact" className="text-primary hover:underline underline-offset-4">send an enquiry</Link> describing the
            workflow, the inputs, and who reviews the output. You can also read{" "}
            <Link href="/blog/guides/what-is-an-ai-agent-and-when-to-use-one" className="text-primary hover:underline underline-offset-4">what an AI agent is and when to use one</Link>.
          </p>
        </div>
      </section>
    </div>
  )
}