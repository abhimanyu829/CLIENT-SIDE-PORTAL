import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { CallToAction } from "@/components/public/CallToAction"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "API Reference — NexusAI",
  description: "Complete API reference for NexusAI endpoints. HTTP requests, response schemas, and authentication.",
}

export default function ApiReferencePage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="API Reference"
        description="Comprehensive documentation for the NexusAI REST API."
        pillText="v2.0.4"
        align="left"
      />

      <div className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Nav */}
          <div className="hidden lg:block lg:col-span-3 border-r border-white/10 pr-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Core</h3>
            <ul className="space-y-2 mb-8 text-sm">
              <li><a href="#" className="text-white font-medium">Authentication</a></li>
              <li><a href="#" className="text-zinc-400 hover:text-white">Errors</a></li>
              <li><a href="#" className="text-zinc-400 hover:text-white">Pagination</a></li>
            </ul>
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-zinc-400 hover:text-white">Agents</a></li>
              <li><a href="#" className="text-zinc-400 hover:text-white">Workflows</a></li>
              <li><a href="#" className="text-zinc-400 hover:text-white">Invoices</a></li>
              <li><a href="#" className="text-zinc-400 hover:text-white">Webhooks</a></li>
            </ul>
          </div>

          {/* Main API Content (Stripe-like split layout) */}
          <div className="lg:col-span-9">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              
              {/* Left Column: Explanations */}
              <div className="prose prose-invert max-w-none prose-h2:mt-0 prose-h2:text-2xl prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2">
                <h2>Authentication</h2>
                <p>
                  The NexusAI API uses API keys to authenticate requests. You can view and manage your API keys in the NexusAI Dashboard.
                </p>
                <p>
                  Your API keys carry many privileges, so be sure to keep them secure! Do not share your secret API keys in publicly accessible areas such as GitHub, client-side code, and so forth.
                </p>
                <p>
                  Authentication to the API is performed via HTTP Bearer Auth. Provide your API key as the bearer token value.
                </p>

                <h2 className="mt-16">Create an Agent</h2>
                <p>Creates a new AI agent in your workspace. You must provide a valid model identifier and system prompt.</p>
                
                <h4 className="text-white font-medium">Parameters</h4>
                <div className="border-t border-white/10 mt-2 pt-2">
                  <div className="flex gap-4 py-3 border-b border-white/5">
                    <div className="w-32 text-sm font-mono text-purple-400">name<br/><span className="text-zinc-500 text-xs">string (req)</span></div>
                    <div className="flex-1 text-sm text-zinc-300">The display name of the agent.</div>
                  </div>
                  <div className="flex gap-4 py-3 border-b border-white/5">
                    <div className="w-32 text-sm font-mono text-purple-400">model<br/><span className="text-zinc-500 text-xs">string (req)</span></div>
                    <div className="flex-1 text-sm text-zinc-300">The underlying LLM (e.g. <code>gpt-4o</code>, <code>claude-3-opus</code>).</div>
                  </div>
                </div>
              </div>

              {/* Right Column: Code snippets */}
              <div className="bg-[#0a0a0c] border border-white/10 rounded-xl overflow-hidden self-start sticky top-24">
                <div className="flex items-center gap-2 bg-black/50 px-4 py-2 border-b border-white/10 text-xs text-zinc-400">
                  <button className="text-white border-b border-purple-500 pb-1">cURL</button>
                  <button className="hover:text-white pb-1">Node.js</button>
                  <button className="hover:text-white pb-1">Python</button>
                </div>
                <div className="p-4 overflow-x-auto text-sm font-mono text-zinc-300">
                  <div className="mb-4">
                    <span className="text-zinc-500"># Authenticate via Bearer Token</span><br/>
                    <span className="text-blue-400">curl</span> https://api.nexusai.com/v2/agents \<br/>
                    &nbsp;&nbsp;-H <span className="text-green-300">"Authorization: Bearer nx_live_secretKey"</span>
                  </div>
                  <div>
                    <span className="text-zinc-500"># Create an Agent Request</span><br/>
                    <span className="text-blue-400">curl</span> -X POST https://api.nexusai.com/v2/agents \<br/>
                    &nbsp;&nbsp;-H <span className="text-green-300">"Content-Type: application/json"</span> \<br/>
                    &nbsp;&nbsp;-H <span className="text-green-300">"Authorization: Bearer nx_live_secretKey"</span> \<br/>
                    &nbsp;&nbsp;-d <span className="text-amber-300">'{'{'}"name": "SalesBot", "model": "gpt-4o"{'}'}'</span>
                  </div>
                </div>
                <div className="bg-black/50 border-t border-white/10 p-4">
                  <span className="text-xs text-zinc-500 mb-2 block">RESPONSE FORMAT (JSON)</span>
                  <pre className="text-sm font-mono text-zinc-300">
{`{
  "id": "agt_98df89",
  "object": "agent",
  "name": "SalesBot",
  "model": "gpt-4o",
  "created_at": 1718294400
}`}
                  </pre>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      
      <CallToAction 
        title="Need deeper integration?"
        description="Our engineers can help architect your custom API implementation."
        ctaText="Talk to Sales"
        ctaHref="/contact-sales"
      />
    </div>
  )
}
