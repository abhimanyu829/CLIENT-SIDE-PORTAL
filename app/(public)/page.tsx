import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="w-full py-24 lg:py-32 bg-gradient-to-b from-background to-muted/50 border-b">
        <div className="container px-4 md:px-6 flex flex-col items-center text-center space-y-8">
          <div className="space-y-4 max-w-[800px]">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              The Ultimate AI Marketplace & SaaS Foundation
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-[600px] mx-auto">
              Launch your AI-powered products faster. Built on Next.js 14, complete with authentication, payments, background jobs, and beautiful UI.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto font-medium">Get Started for Free</Button>
            </Link>
            <Link href="/demo">
              <Button variant="outline" size="lg" className="w-full sm:w-auto font-medium">View Live Demos</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <section className="w-full py-12 bg-background border-b">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
              <h3 className="text-4xl font-bold">10x</h3>
              <p className="text-sm text-muted-foreground font-medium">Faster Development</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-4xl font-bold">99.9%</h3>
              <p className="text-sm text-muted-foreground font-medium">Uptime Guarantee</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-4xl font-bold">50+</h3>
              <p className="text-sm text-muted-foreground font-medium">Built-in Components</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-4xl font-bold">24/7</h3>
              <p className="text-sm text-muted-foreground font-medium">Expert Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="w-full py-24 bg-muted/30 border-b">
        <div className="container px-4 md:px-6 space-y-12">
          <div className="text-center space-y-4 max-w-[800px] mx-auto">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to scale</h2>
            <p className="text-muted-foreground md:text-lg">
              Stop reinventing the wheel. We've packaged the best modern web technologies into a single, cohesive platform.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-background p-6 rounded-xl border shadow-sm space-y-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-xl font-bold">🔒</div>
              <h3 className="text-xl font-bold">Secure Authentication</h3>
              <p className="text-muted-foreground">
                Role-based access control, social logins, and secure session management out of the box with NextAuth.
              </p>
            </div>
            <div className="bg-background p-6 rounded-xl border shadow-sm space-y-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-xl font-bold">💳</div>
              <h3 className="text-xl font-bold">Global Payments</h3>
              <p className="text-muted-foreground">
                Accept subscriptions and one-off payments globally using Stripe and Razorpay integrations.
              </p>
            </div>
            <div className="bg-background p-6 rounded-xl border shadow-sm space-y-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-xl font-bold">🤖</div>
              <h3 className="text-xl font-bold">AI Native</h3>
              <p className="text-muted-foreground">
                Deeply integrated with OpenAI. Run embedding jobs, semantic search, and streaming chat instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="w-full py-24 bg-background border-b">
        <div className="container px-4 md:px-6 space-y-12">
          <div className="text-center space-y-4 max-w-[800px] mx-auto">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
            <p className="text-muted-foreground md:text-lg">
              Start for free, upgrade when you need to scale. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-[1000px] mx-auto">
            {/* Starter */}
            <div className="bg-background p-8 rounded-2xl border shadow-sm flex flex-col">
              <div className="space-y-2 mb-6">
                <h3 className="text-xl font-bold">Starter</h3>
                <p className="text-muted-foreground text-sm">Perfect for indie hackers</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">✓ Up to 1,000 MAU</li>
                <li className="flex items-center gap-2">✓ Community Support</li>
                <li className="flex items-center gap-2">✓ Basic Analytics</li>
              </ul>
              <Button variant="outline" className="w-full">Get Started</Button>
            </div>
            
            {/* Pro */}
            <div className="bg-primary/5 p-8 rounded-2xl border-2 border-primary shadow-md flex flex-col relative">
              <div className="absolute top-0 right-8 transform -translate-y-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
              </div>
              <div className="space-y-2 mb-6">
                <h3 className="text-xl font-bold">Pro</h3>
                <p className="text-muted-foreground text-sm">For scaling startups</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold">$49</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2 text-foreground">✓ Up to 10,000 MAU</li>
                <li className="flex items-center gap-2 text-foreground">✓ Priority Email Support</li>
                <li className="flex items-center gap-2 text-foreground">✓ Advanced AI Tools</li>
                <li className="flex items-center gap-2 text-foreground">✓ Custom Domains</li>
              </ul>
              <Button className="w-full">Start 14-Day Trial</Button>
            </div>

            {/* Enterprise */}
            <div className="bg-background p-8 rounded-2xl border shadow-sm flex flex-col">
              <div className="space-y-2 mb-6">
                <h3 className="text-xl font-bold">Enterprise</h3>
                <p className="text-muted-foreground text-sm">For large organizations</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold">$299</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">✓ Unlimited MAU</li>
                <li className="flex items-center gap-2">✓ 24/7 Phone Support</li>
                <li className="flex items-center gap-2">✓ Dedicated Account Manager</li>
                <li className="flex items-center gap-2">✓ SLA Guarantee</li>
              </ul>
              <Button variant="outline" className="w-full">Contact Sales</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="w-full py-24 bg-muted/30 border-b">
        <div className="container px-4 md:px-6">
          <div className="text-center space-y-4 mb-16 max-w-[800px] mx-auto">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Loved by builders worldwide</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-background p-6 rounded-xl border shadow-sm space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">
                    U{i}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Startup Founder {i}</p>
                    <p className="text-xs text-muted-foreground">Tech Innovators Inc.</p>
                  </div>
                </div>
                <p className="text-muted-foreground italic text-sm">
                  "This platform saved us months of engineering time. The pre-built modules for payments and auth are incredibly robust and easy to customize."
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="w-full py-24 bg-primary text-primary-foreground">
        <div className="container px-4 md:px-6 flex flex-col items-center text-center space-y-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to ship your next big idea?</h2>
          <p className="text-primary-foreground/80 max-w-[600px] text-lg">
            Join thousands of developers who are already building the future with OpenClaude.
          </p>
          <div className="flex gap-4 mt-8">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="font-bold">Create Free Account</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
