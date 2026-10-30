import type { Metadata } from "next"
import PartnersClient from "./PartnersClient"

export const metadata: Metadata = {
  title: "Partner Network & Ecosystem — ABHIBHIDEVELOPERS GROUP | Abhibhideveloper",
  description:
    "Join the Abhibhi Developers Partner Network. Earn up to 25% recurring revenue share, gain dedicated solution architects, and co-sell autonomous AI agents with Abhibhideveloper.",
}

export default function PartnersPage() {
  return <PartnersClient />
}
