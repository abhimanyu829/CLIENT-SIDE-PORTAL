"use client"

import React from "react"
import {
  Sparkles,
  Target,
  ClipboardCheck,
  Tag,
  ShieldAlert,
  HelpCircle,
  Layers,
  CheckCircle2,
} from "lucide-react"

interface SectionItem {
  type: "number" | "bullet"
  num?: string
  text: string
}

interface ParsedSection {
  title: string
  content: string[]
  listItems: SectionItem[]
}

const KNOWN_HEADING_PATTERNS = [
  "Overview",
  "Where it can fit",
  "Where It Can Fit",
  "How to evaluate[^\\n0-9.:]*",
  "How To Evaluate[^\\n0-9.:]*",
  "Pricing and availability",
  "Pricing And Availability",
  "Important considerations",
  "Important Considerations",
  "Quick answer",
  "Quick Answer",
  "Key Features",
  "Features",
  "Use Cases",
  "What's included",
  "What's Included",
  "Requirements",
  "Summary",
]

export function normalizeMarkdownStructure(text: string): string {
  if (!text) return ""

  let result = text.trim()

  // Ensure newlines before headings
  result = result.replace(/([^\n])\s*##\s+/g, "$1\n\n## ")
  result = result.replace(/([^\n])\s*###\s+/g, "$1\n\n### ")

  // If heading title was merged into body text without newline
  for (const pattern of KNOWN_HEADING_PATTERNS) {
    const re = new RegExp(`(##\\s+${pattern})\\s+([A-Z0-9])`, "gi")
    result = result.replace(re, "$1\n$2")
  }

  // Ensure newlines before numbered points (e.g. " 1. ", ". 2. ")
  result = result.replace(/([.!?]|\b)\s+(\d+)\.\s+/g, "$1\n$2. ")

  // Ensure newlines before bullet points
  result = result.replace(/([.!?]|\b)\s+([•\-*])\s+/g, "$1\n- ")

  return result
}

export function parseStructuredDescription(rawText: string): ParsedSection[] {
  if (!rawText) return []

  const normalized = normalizeMarkdownStructure(rawText)

  const headingRegex = /(?:^|\n)##\s+([^\n]+)/g
  const matches: { title: string; index: number; length: number }[] = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(normalized)) !== null) {
    matches.push({ title: match[1].trim(), index: match.index, length: match[0].length })
  }

  if (matches.length === 0) {
    // No headings found - split by paragraphs or list items
    const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const content: string[] = []
    const listItems: SectionItem[] = []

    for (const line of lines) {
      const numMatch = line.match(/^(\d+)\.\s+(.*)/)
      const bulletMatch = line.match(/^[•\-*]\s+(.*)/)
      if (numMatch) {
        listItems.push({ type: "number", num: numMatch[1], text: numMatch[2] })
      } else if (bulletMatch) {
        listItems.push({ type: "bullet", text: bulletMatch[1] })
      } else {
        content.push(line)
      }
    }

    return [{ title: "Overview", content, listItems }]
  }

  const sections: ParsedSection[] = []

  // Pre-heading text
  if (matches[0].index > 0) {
    const preText = normalized.slice(0, matches[0].index).trim()
    if (preText) {
      sections.push({
        title: "Overview",
        content: preText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
        listItems: [],
      })
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]
    const startIndex = cur.index + cur.length
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : normalized.length
    const rawBody = normalized.slice(startIndex, endIndex).trim()

    const lines = rawBody.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const regularParagraphs: string[] = []
    const listItems: SectionItem[] = []

    for (const line of lines) {
      const numMatch = line.match(/^(\d+)\.\s+(.*)/)
      const bulletMatch = line.match(/^[•\-*]\s+(.*)/)

      if (numMatch) {
        listItems.push({ type: "number", num: numMatch[1], text: numMatch[2] })
      } else if (bulletMatch) {
        listItems.push({ type: "bullet", text: bulletMatch[1] })
      } else {
        const inlinePoints = line.split(/(?=\b\d+\.\s+)/).map((s) => s.trim()).filter(Boolean)
        if (inlinePoints.length > 1 && /^\d+\.\s+/.test(inlinePoints[0])) {
          for (const pt of inlinePoints) {
            const m = pt.match(/^(\d+)\.\s+(.*)/)
            if (m) listItems.push({ type: "number", num: m[1], text: m[2] })
            else regularParagraphs.push(pt)
          }
        } else {
          regularParagraphs.push(line)
        }
      }
    }

    sections.push({
      title: cur.title,
      content: regularParagraphs,
      listItems,
    })
  }

  return sections
}

function getSectionMeta(title: string) {
  const lower = title.toLowerCase()

  if (lower.includes("overview") || lower.includes("summary")) {
    return {
      icon: Sparkles,
      iconColor: "text-violet-600",
      badgeColor: "bg-violet-50 border-violet-200",
      cardBorder: "border-zinc-200/90 hover:border-violet-300",
    }
  }
  if (lower.includes("where it can fit") || lower.includes("use cases") || lower.includes("fit")) {
    return {
      icon: Target,
      iconColor: "text-blue-600",
      badgeColor: "bg-blue-50 border-blue-200",
      cardBorder: "border-zinc-200/90 hover:border-blue-300",
    }
  }
  if (lower.includes("how to evaluate") || lower.includes("evaluate") || lower.includes("steps")) {
    return {
      icon: ClipboardCheck,
      iconColor: "text-emerald-600",
      badgeColor: "bg-emerald-50 border-emerald-200",
      cardBorder: "border-zinc-200/90 hover:border-emerald-300",
    }
  }
  if (lower.includes("pricing") || lower.includes("availability") || lower.includes("cost")) {
    return {
      icon: Tag,
      iconColor: "text-amber-700",
      badgeColor: "bg-amber-50 border-amber-200",
      cardBorder: "border-amber-200/80 bg-gradient-to-b from-amber-50/40 to-white",
    }
  }
  if (lower.includes("important") || lower.includes("considerations") || lower.includes("notice") || lower.includes("legal")) {
    return {
      icon: ShieldAlert,
      iconColor: "text-rose-600",
      badgeColor: "bg-rose-50 border-rose-200",
      cardBorder: "border-rose-200/80 bg-gradient-to-b from-rose-50/40 to-white",
    }
  }
  if (lower.includes("quick answer") || lower.includes("faq")) {
    return {
      icon: HelpCircle,
      iconColor: "text-cyan-600",
      badgeColor: "bg-cyan-50 border-cyan-200",
      cardBorder: "border-zinc-200/90 hover:border-cyan-300",
    }
  }

  return {
    icon: Layers,
    iconColor: "text-zinc-600",
    badgeColor: "bg-zinc-100 border-zinc-200",
    cardBorder: "border-zinc-200/90 hover:border-zinc-300",
  }
}

function renderFormattedInlineText(text: string) {
  if (!text.includes("**")) return text

  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="text-zinc-950 font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

interface ProductStructuredDescriptionProps {
  content: string
  className?: string
  isCompact?: boolean
}

export default function ProductStructuredDescription({
  content,
  className = "",
  isCompact = false,
}: ProductStructuredDescriptionProps) {
  const sections = React.useMemo(() => parseStructuredDescription(content), [content])

  if (!sections || sections.length === 0) {
    return <p className="text-zinc-600 text-sm leading-relaxed">No description available.</p>
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {sections.map((section, sIdx) => {
        const meta = getSectionMeta(section.title)
        const IconComponent = meta.icon

        return (
          <div
            key={sIdx}
            className={`rounded-2xl p-6 sm:p-7 transition-all duration-200 border bg-white shadow-xs hover:shadow-sm ${meta.cardBorder}`}
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${meta.badgeColor}`}
              >
                <IconComponent className={`w-4 h-4 ${meta.iconColor}`} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-zinc-950 tracking-tight">
                {section.title}
              </h3>
            </div>

            {/* Paragraph Content */}
            {section.content.length > 0 && (
              <div className="space-y-3 mb-4">
                {section.content.map((paragraph, pIdx) => (
                  <p
                    key={pIdx}
                    className="text-sm sm:text-base text-zinc-700 leading-relaxed font-normal"
                  >
                    {renderFormattedInlineText(paragraph)}
                  </p>
                ))}
              </div>
            )}

            {/* Point-wise List Items (Numbered Steps or Bullets) */}
            {section.listItems.length > 0 && (
              <div className="mt-4 space-y-2.5">
                {section.listItems.map((item, iIdx) => {
                  if (item.type === "number") {
                    return (
                      <div
                        key={iIdx}
                        className="flex items-start gap-3.5 p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/70 hover:border-violet-300 hover:bg-violet-50/30 transition-colors"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-violet-600 text-white flex items-center justify-center text-xs font-bold mt-0.5 shadow-xs">
                          {item.num}
                        </span>
                        <div className="text-sm text-zinc-800 leading-relaxed flex-1 font-medium">
                          {renderFormattedInlineText(item.text)}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={iIdx}
                      className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50/80 border border-zinc-200/70 hover:border-zinc-300 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-zinc-800 leading-relaxed flex-1 font-medium">
                        {renderFormattedInlineText(item.text)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}