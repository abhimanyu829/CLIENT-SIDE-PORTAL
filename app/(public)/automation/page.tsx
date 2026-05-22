import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { StatsRow } from "@/components/public/StatsRow"
import { FAQSection } from "@/components/public/FAQSection"
import { CallToAction } from "@/components/public/CallToAction"
import { GitMerge, Zap, Calendar, Mail, MessageSquare, Briefcase } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Workflow Automation — NexusAI",
  description: "Automate your business processes with our visual workflow builder and AI triggers. Connect 100+ apps effortlessly.",
  openGraph: {
    title: "Workflow Automation — NexusAI",
    description: "Automate your business processes with our visual workflow builder and AI triggers.",
  }
}

export default function AutomationPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="Put Your Business on Autopilot"
        description="Visually design, test, and deploy complex business workflows. Connect NexusAI agents with your favorite apps to eliminate repetitive manual tasks forever."
        pillText="No-Code Automation"
        ctaText="Try Workflow Builder"
        ctaHref="/register"
        secondaryCtaText="See Examples"
        secondaryCtaHref="/live-demos"
      />

      <StatsRow stats={[
        { value: "1M+", label: "Workflows Run Daily" },
        { value: "500+", label: "App Integrations" },
        { value: "20hrs", label: "Saved per User/Week" },
        { value: "0", label: "Lines of Code Needed" }
      ]} />

      <FeatureGrid 
        title="Intelligent Automation Features"
        description="More than just point-to-point triggers. Build complex logic powered by AI."
        features={[
          { icon: GitMerge, title: "Visual Flow Builder", description: "Drag and drop triggers, actions, and conditional logic nodes to build workflows without writing code." },
          { icon: Zap, title: "AI-Powered Parsing", description: "Use AI nodes to extract structured data from unstructured emails, PDFs, or chat messages mid-workflow." },
          { icon: Calendar, title: "Scheduled Triggers", description: "Run complex data syncs or generate reports automatically on daily, weekly, or custom cron schedules." },
          { icon: Mail, title: "Email Automation", description: "Automatically read incoming support emails, classify the intent with AI, and draft contextual replies." },
          { icon: MessageSquare, title: "Slack & Teams Integration", description: "Send automated alerts, request approvals, and interact with your workflows directly from your chat app." },
          { icon: Briefcase, title: "CRM Sync", description: "Keep HubSpot, Salesforce, and Pipedrive in perfect sync with your internal databases automatically." }
        ]}
      />

      <FAQSection 
        title="Automation FAQs"
        faqs={[
          { question: "Do I need to know how to code?", answer: "Not at all. The visual builder is designed for business users. However, developers can add custom Node.js/Python scripts if needed." },
          { question: "How are automations priced?", answer: "You are billed based on 'task executions' (each step a workflow takes). See our pricing page for detailed tier limits." },
          { question: "Can I connect internal, proprietary APIs?", answer: "Yes! You can use the generic 'HTTP Request' node to connect to any REST or GraphQL API, including internal ones." }
        ]}
      />

      <CallToAction 
        title="Stop doing manual work"
        description="Reclaim your team's time by automating data entry, routing, and reporting."
        ctaText="Start Automating"
        ctaHref="/register"
      />
    </div>
  )
}
