import type { Metadata } from "next"
import { BrandSectionList } from "@/components/content/BrandBlocks"
import { HOW_WE_DELIVER, MARKETPLACE_BRAND } from "@/lib/content/brand-blocks"

export const metadata: Metadata = {
  title: "How It Works | Abhibhideveloper",
  description:
    "How Abhibhideveloper delivers technology solutions: discovery, scope and commercial agreement, development or provisioning, testing, deployment, maintenance and service management.",
}

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BrandSectionList
        sections={[
          {
            heading: "How Abhibhideveloper works",
            lead: "From your first enquiry through deployment, maintenance, and subscription management — this is the delivery process you can expect.",
          },
          ...HOW_WE_DELIVER,
          ...MARKETPLACE_BRAND,
        ]}
      />
    </div>
  )
}