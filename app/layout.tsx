import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/layout/Providers"

export const metadata: Metadata = {
  title: {
    default: "OpenClaude — AI SaaS Platform",
    template: "%s — OpenClaude",
  },
  description:
    "Deploy AI agents, manage subscriptions, and automate your business workflows with OpenClaude.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
}

import { ClerkProvider } from "@clerk/nextjs"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="font-sans antialiased">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
