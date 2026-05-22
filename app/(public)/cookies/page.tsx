import React from "react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cookie Policy — NexusAI",
  description: "Information about how NexusAI uses cookies and tracking technologies.",
}

export default function CookiesPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black mb-6">Cookie Policy</h1>
        <p className="text-zinc-500 mb-12">Last Updated: May 21, 2026</p>

        <div className="prose prose-invert max-w-none text-zinc-300">
          <h2>What are cookies?</h2>
          <p>
            Cookies are small text files stored on your device when you visit a website. They are widely used to make websites work more efficiently and provide information to the site owners.
          </p>

          <h2>How we use cookies</h2>
          <p>We use cookies for the following purposes:</p>
          <ul>
            <li><strong>Essential Cookies:</strong> Required for the platform to function (e.g., keeping you logged in, CSRF protection). These cannot be disabled.</li>
            <li><strong>Analytics Cookies:</strong> Help us understand how visitors interact with the dashboard, identifying bottlenecks and improving UX.</li>
            <li><strong>Preferences Cookies:</strong> Remember your settings, such as theme choice (dark/light mode) or preferred billing currency.</li>
          </ul>

          <h2>Managing your preferences</h2>
          <p>
            You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept essential cookies, you will not be able to log into the NexusAI dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}
