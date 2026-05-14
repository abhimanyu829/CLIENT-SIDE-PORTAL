import { Lead, LeadInteraction, User } from "@prisma/client"

// Lead with all interactions
export type LeadWithInteractions = Lead & {
  interactions: LeadInteraction[]
  assignee?: Pick<User, "id" | "name" | "avatarUrl"> | null
}

// Kanban card (minimal for pipeline view)
export type LeadCard = Pick<
  Lead,
  | "id"
  | "name"
  | "email"
  | "company"
  | "stage"
  | "source"
  | "score"
  | "createdAt"
> & {
  assignee?: Pick<User, "id" | "name" | "avatarUrl"> | null
}

// CRM pipeline stage values
export const CRM_STAGES = [
  "NEW",
  "CONTACTED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const
export type CRMStage = (typeof CRM_STAGES)[number]

// Lead source values
export const LEAD_SOURCES = [
  "WEBSITE",
  "REFERRAL",
  "EMAIL",
  "LINKEDIN",
  "COLD_OUTREACH",
  "CONFERENCE",
  "OTHER",
] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

// KPI computed stats for CRM dashboard
export interface CRMStats {
  totalLeads: number
  pipelineValue: number
  wonValue: number
  winRate: number // 0-100 percentage
  avgDealSize: number
  byStage: Record<CRMStage, number>
}
