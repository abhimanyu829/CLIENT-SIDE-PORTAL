import type { Metadata } from "next"
import { BrandSectionList } from "@/components/content/BrandBlocks"
import { ACCEPTABLE_USE } from "@/lib/content/legal-blocks"

export const metadata: Metadata = {
  title: "Acceptable Use Policy | Abhibhideveloper",
  description:
    "Acceptable Use Policy for Abhibhideveloper websites, applications, AI tools and services: lawful, authorized and responsible use.",
}

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BrandSectionList sections={ACCEPTABLE_USE} eyebrow="Policies" />
    </div>
  )
}