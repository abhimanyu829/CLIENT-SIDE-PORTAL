import type { Metadata } from "next"
import PricingClient from "./PricingClient"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Pricing & Services — Abhibhi Developers | Transparent Software, Web & AI Solutions",
  description:
    "Explore transparent pricing for websites, cloud SaaS solutions, school and clinic software, AI automation add-ons, and local business growth pilots by Abhibhi Developers.",
}

export default function PricingPage() {
  return <PricingClient />
}
