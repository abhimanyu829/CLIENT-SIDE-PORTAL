import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import { ReactNode } from "react"
import { db } from "@/lib/db"
import { CampaignStatus } from "@prisma/client"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
const APP_NAME = "NexusAI"
const APP_DESCRIPTION = "The world's most advanced AI SaaS marketplace. Deploy AI agents, SaaS tools, APIs, and automation workflows in one click."

async function getActiveCampaign() {
  try {
    const now = new Date()
    return await db.campaign.findFirst({
      where: { status: CampaignStatus.ACTIVE, startsAt: { lte: now }, endsAt: { gte: now } },
      select: { id: true, bannerText: true, ctaText: true, ctaUrl: true },
      orderBy: { startsAt: "desc" },
    })
  } catch { return null }
}

// JSON-LD WebSite + Organization structured data
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      "url": APP_URL,
      "name": APP_NAME,
      "description": APP_DESCRIPTION,
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${APP_URL}/marketplace?search={search_term_string}`
        },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "Organization",
      "@id": `${APP_URL}/#organization`,
      "name": APP_NAME,
      "url": APP_URL,
      "logo": {
        "@type": "ImageObject",
        "url": `${APP_URL}/logo.png`
      },
      "sameAs": []
    }
  ]
}

export const metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — AI SaaS Marketplace`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ["AI agents", "SaaS marketplace", "AI tools", "automation", "developer tools", "enterprise AI"],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} — AI SaaS Marketplace`,
    description: APP_DESCRIPTION,
    images: [{ url: `${APP_URL}/og-default.png`, width: 1200, height: 630, alt: APP_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — AI SaaS Marketplace`,
    description: APP_DESCRIPTION,
    images: [`${APP_URL}/og-default.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: { canonical: APP_URL },
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const campaign = await getActiveCampaign()

  const announcement = campaign?.bannerText ? {
    text: campaign.bannerText,
    ctaText: campaign.ctaText,
    ctaUrl: campaign.ctaUrl,
  } : null

  return (
    <div className="flex min-h-screen flex-col">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <Navbar announcement={announcement} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
