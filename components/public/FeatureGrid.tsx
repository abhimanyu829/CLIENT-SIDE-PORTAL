import React from "react"
import { LucideIcon } from "lucide-react"

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

interface FeatureGridProps {
  title?: string
  description?: string
  features: Feature[]
}

export function FeatureGrid({ title, description, features }: FeatureGridProps) {
  return (
    <section className="py-24 border-t border-white/5 bg-[#080808]">
      <div className="max-w-7xl mx-auto px-6">
        {(title || description) && (
          <div className="mb-16 md:text-center max-w-3xl mx-auto">
            {title && <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>}
            {description && <p className="text-zinc-400 text-lg">{description}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <div key={i} className="group p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
