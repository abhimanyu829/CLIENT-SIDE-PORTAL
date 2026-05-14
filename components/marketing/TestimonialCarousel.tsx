"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Star, Quote } from "lucide-react"
import { cn } from "@/lib/utils"

const testimonials = [
  {
    name: "Priya Sharma",
    role: "CTO, FinFlow",
    avatar: "PS",
    rating: 5,
    text: "We replaced three separate SaaS tools with OpenClaude. The AI agents alone saved us 40 hours a week. The CRM pipeline was set up in an afternoon.",
  },
  {
    name: "Arjun Mehta",
    role: "Founder, ScaleOps",
    avatar: "AM",
    rating: 5,
    text: "The Razorpay integration worked out of the box for our Indian customers. Billing, subscriptions, invoices — everything just worked. Genuinely impressed.",
  },
  {
    name: "Sarah Chen",
    role: "Product Lead, Nimbus AI",
    avatar: "SC",
    rating: 5,
    text: "The live demo feature is a game-changer for sales. Our conversion rate went up 3x after letting prospects try the product before buying.",
  },
  {
    name: "David Okonkwo",
    role: "Head of Engineering, Volta",
    avatar: "DO",
    rating: 5,
    text: "I've built three SaaS platforms from scratch. OpenClaude cut my infrastructure work by 80%. The audit logs and RBAC saved us weeks of compliance work.",
  },
  {
    name: "Aisha Patel",
    role: "CEO, CogniDash",
    avatar: "AP",
    rating: 5,
    text: "Support tickets used to be a nightmare. The built-in ticket system with AI reply suggestions means our support team responds in half the time.",
  },
]

export default function TestimonialCarousel() {
  const [current, setCurrent] = useState(0)

  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length)
  const next = () => setCurrent((c) => (c + 1) % testimonials.length)

  const t = testimonials[current]

  return (
    <section className="py-24 px-4 bg-muted/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Loved by builders worldwide
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Join hundreds of teams shipping faster with OpenClaude.
          </p>
        </div>

        <div className="relative bg-card border rounded-2xl p-8 md:p-12 shadow-sm text-center">
          <Quote className="w-8 h-8 text-primary/30 mx-auto mb-6" />

          <p className="text-lg md:text-xl leading-relaxed text-foreground mb-8">
            &ldquo;{t.text}&rdquo;
          </p>

          {/* Stars */}
          <div className="flex justify-center gap-1 mb-6">
            {Array.from({ length: t.rating }).map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            ))}
          </div>

          {/* Avatar */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {t.avatar}
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.role}</p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={prev}
              aria-label="Previous testimonial"
              className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to testimonial ${i + 1}`}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === current ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            <button
              onClick={next}
              aria-label="Next testimonial"
              className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
