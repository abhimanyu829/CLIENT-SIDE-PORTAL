import React from "react"

interface CallToActionProps {
  title: string
  description: string
  ctaText?: string
  ctaHref?: string
}

export function CallToAction({ title, description, ctaText = "Get Started", ctaHref = "/register" }: CallToActionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 border border-purple-500/30 p-12 md:p-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">{title}</h2>
          <p className="text-lg text-purple-200 mb-10">{description}</p>
          <a href={ctaHref} className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.4)]">
            {ctaText}
          </a>
        </div>
      </div>
    </section>
  )
}
