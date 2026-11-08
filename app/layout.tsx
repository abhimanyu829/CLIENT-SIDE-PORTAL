import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/layout/Providers"
import { ClerkProvider } from "@clerk/nextjs"
import { ui } from "@clerk/ui"
import { clerkAppearance } from "@/lib/clerk"
import { AiSupportWidget } from "@/components/ai-support/AiSupportWidget"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://abhibhideveloper.tech"

export const metadata: Metadata = {
  title: {
    default: "Abhibhideveloper — AI SaaS Marketplace & Software Solutions",
    template: "%s",
  },
  description:
    "Deploy autonomous AI agents, explore SaaS software, and scale your business with Abhibhideveloper.",
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: "/abhibhi-logo.jpg",
    apple: "/abhibhi-logo.jpg",
  },
  openGraph: {
    siteName: "Abhibhideveloper",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Abhibhideveloper",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/register"
      afterSignOutUrl="/"
      appearance={clerkAppearance}
      ui={ui}
    >
      <html lang="en" suppressHydrationWarning>
        <body className="light-theme font-sans antialiased">
          <Providers>{children}</Providers>
          {/* Global support chat — fixed viewport layer, z-[10000] to sit above campaign modal (z-[9999]) */}
          <AiSupportWidget />
        </body>
      </html>
    </ClerkProvider>
  )
}
