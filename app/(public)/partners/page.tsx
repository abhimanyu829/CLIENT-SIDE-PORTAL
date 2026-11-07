import type { Metadata } from "next"
import PartnersClient from "./PartnersClient"

export const metadata: Metadata = {
  title: "Partner Network & Ecosystem — Abhibhideveloper",
  description:
    "Join the Abhibhideveloper Partner Network. Earn up to 25% recurring revenue share, gain dedicated solution architects, and co-sell autonomous AI agents with Abhibhideveloper.",
  alternates: { canonical: "https://abhibhideveloper.tech/partners" },
}

export default function PartnersPage() {
  return <PartnersClient />
}
