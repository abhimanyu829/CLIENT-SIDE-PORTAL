import { Metadata } from "next"
import ContactSalesClient from "./ContactSalesClient"

export const metadata: Metadata = {
  title: "Contact Sales — NexusAI Enterprise Solutions",
  description: "Get in touch with the NexusAI sales team for enterprise pricing, custom AI deployments, and volume discounts.",
}

export default function ContactSalesPage() {
  return <ContactSalesClient />
}
