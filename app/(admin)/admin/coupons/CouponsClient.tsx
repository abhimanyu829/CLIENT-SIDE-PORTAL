"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { useToast } from "@/hooks/use-toast"
import { CouponType, CampaignType, CampaignStatus } from "@prisma/client"
import {
  createCoupon, updateCoupon, bulkGenerateCoupons, createCampaign, updateCampaign,
  toggleCampaign, deactivateCouponAction, deleteCoupon, duplicateCampaign, deleteCampaign
} from "./actions"
import {
  Tag, Gift, Sparkles, Percent, Calendar, AlertOctagon, X, Plus,
  Clock, Download, Search, MoreVertical, Filter, Copy, Trash2,
  Play, Pause, FlameKindling, Globe, Users, BarChart2, RefreshCw,
  ChevronDown, Zap, Target, Star, Award, Edit, CheckCircle,
  AlertTriangle, Eye, Info, Megaphone, DollarSign
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Coupon {
  id: string
  code: string
  name?: string | null
  description?: string | null
  type: CouponType
  discountValue: number
  maxDiscountCap?: number | null
  freeCredits?: number | null
  freeTokens?: number | null
  trialExtensionDays?: number | null
  maxUses: number | null
  perUserLimit: number
  usedCount: number
  applicableTierIds: string[]
  applicableProductIds?: string[]
  minCartValue?: number | null
  targetSegment?: string | null
  requiresSubscription: boolean
  newUsersOnly: boolean
  allowedGeos?: string[]
  campaignId?: string | null
  affiliateCode?: string | null
  startsAt?: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

interface Campaign {
  id: string
  name: string
  label?: string | null
  description?: string | null
  type: CampaignType
  status: CampaignStatus
  startsAt: string
  endsAt: string
  discountPercent: number
  flatDiscount?: number | null
  bannerText?: string | null
  bannerImageUrl?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  applicableTierIds: string[]
  targetSegment?: string | null
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  isActive: boolean
  createdAt: string
}

interface TierSelection {
  id: string
  name: string
  productName: string
}

interface Props {
  coupons: Coupon[]
  campaigns: Campaign[]
  productTiers: TierSelection[]
}

// ─── Coupon Type Config ──────────────────────────────────────────────────────────

const COUPON_TYPE_CONFIG: Record<CouponType, { label: string; icon: string; color: string; description: string }> = {
  PERCENTAGE: { label: "% Off", icon: "Percent", color: "bg-violet-100 text-violet-800", description: "Percentage discount" },
  FLAT: { label: "Flat $", icon: "DollarSign", color: "bg-blue-100 text-blue-800", description: "Fixed amount off" },
  TRIAL_EXTENSION: { label: "Trial+", icon: "Clock", color: "bg-teal-100 text-teal-800", description: "Extends trial period" },
  FREE_CREDITS: { label: "Credits", icon: "Zap", color: "bg-yellow-100 text-yellow-800", description: "Free platform credits" },
  FREE_TOKENS: { label: "Tokens", icon: "Sparkles", color: "bg-indigo-100 text-indigo-800", description: "Free AI tokens" },
  FREE_ADDON: { label: "Addon", icon: "Gift", color: "bg-pink-100 text-pink-800", description: "Free addon product" },
  UPGRADE: { label: "Upgrade", icon: "Award", color: "bg-amber-100 text-amber-800", description: "Free tier upgrade" },
  REFERRAL: { label: "Referral", icon: "Users", color: "bg-emerald-100 text-emerald-800", description: "Referral reward" },
  FIRST_TIME: { label: "New User", icon: "Star", color: "bg-cyan-100 text-cyan-800", description: "First purchase only" },
  FESTIVAL: { label: "Festival", icon: "Calendar", color: "bg-rose-100 text-rose-800", description: "Holiday/festival promo" },
  FLASH_SALE: { label: "Flash Sale", icon: "FlameKindling", color: "bg-red-100 text-red-800", description: "Limited-time flash deal" },
  INFLUENCER: { label: "Influencer", icon: "Megaphone", color: "bg-fuchsia-100 text-fuchsia-800", description: "Influencer partnership" },
  AFFILIATE: { label: "Affiliate", icon: "Link", color: "bg-orange-100 text-orange-800", description: "Affiliate commission" },
  GEO_TARGETED: { label: "Geo", icon: "Globe", color: "bg-slate-100 text-slate-800", description: "Region-specific deal" },
  RETENTION: { label: "Retention", icon: "Target", color: "bg-purple-100 text-purple-800", description: "Churn prevention offer" },
}

const CAMPAIGN_TYPE_CONFIG: Record<CampaignType, { label: string; color: string; emoji: string }> = {
  FESTIVAL: { label: "Festival", color: "bg-rose-100 text-rose-800", emoji: "🎉" },
  FLASH: { label: "Flash Sale", color: "bg-red-100 text-red-800", emoji: "⚡" },
  REFERRAL: { label: "Referral", color: "bg-emerald-100 text-emerald-800", emoji: "👥" },
  LOYALTY: { label: "Loyalty", color: "bg-amber-100 text-amber-800", emoji: "💛" },
  BLACKFRIDAY: { label: "Black Friday", color: "bg-zinc-800 text-zinc-100", emoji: "🛍️" },
  INFLUENCER: { label: "Influencer", color: "bg-fuchsia-100 text-fuchsia-800", emoji: "🎯" },
  AB_TEST: { label: "A/B Test", color: "bg-blue-100 text-blue-800", emoji: "🔬" },
  RETENTION: { label: "Retention", color: "bg-purple-100 text-purple-800", emoji: "🔒" },
  AFFILIATE: { label: "Affiliate", color: "bg-orange-100 text-orange-800", emoji: "🤝" },
  CUSTOM: { label: "Custom", color: "bg-slate-100 text-slate-800", emoji: "✨" },
}

const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  SCHEDULED: { label: "Scheduled", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  ACTIVE: { label: "Active", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  PAUSED: { label: "Paused", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  ENDED: { label: "Ended", color: "bg-zinc-100 text-zinc-500" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800" },
}

function formatDiscount(coupon: Coupon): string {
  switch (coupon.type) {
    case "PERCENTAGE": return `${coupon.discountValue}% Off`
    case "FLAT": return `$${coupon.discountValue} Off`
    case "TRIAL_EXTENSION": return `+${coupon.trialExtensionDays || coupon.discountValue}d Trial`
    case "FREE_CREDITS": return `${coupon.freeCredits || coupon.discountValue} Credits`
    case "FREE_TOKENS": return `${(coupon.freeTokens || coupon.discountValue).toLocaleString()} Tokens`
    case "UPGRADE": return "Free Upgrade"
    case "FREE_ADDON": return "Free Addon"
    default: return `${coupon.discountValue} ${coupon.type}`
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function CouponsClient({ coupons: initialCoupons, campaigns: initialCampaigns, productTiers }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons)
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"coupons" | "campaigns">("coupons")

  // Live clock for countdown timers
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Filter state for coupons
  const [couponSearch, setCouponSearch] = useState("")
  const [couponTypeFilter, setCouponTypeFilter] = useState<string>("ALL")
  const [couponStatusFilter, setCouponStatusFilter] = useState<string>("ALL")

  // Modal states
  const [couponModal, setCouponModal] = useState<"create" | "bulk" | "edit" | null>(null)
  const [campaignModal, setCampaignModal] = useState<"create" | "edit" | null>(null)
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null)
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Coupon | null>(null)
  const [killCampaign, setKillCampaign] = useState<Campaign | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: "coupon" | "campaign"; id: string; name: string } | null>(null)

  // ── Coupon form fields ──────────────────────────────────────────────────────

  const [cCode, setCCode] = useState("")
  const [cName, setCName] = useState("")
  const [cDesc, setCDesc] = useState("")
  const [cType, setCType] = useState<CouponType>("PERCENTAGE")
  const [cVal, setCVal] = useState("")
  const [cCap, setCCap] = useState("")
  const [cFreeCredits, setCFreeCredits] = useState("")
  const [cFreeTokens, setCFreeTokens] = useState("")
  const [cTrialDays, setCTrialDays] = useState("")
  const [cMaxUses, setCMaxUses] = useState("")
  const [cPerUser, setCPerUser] = useState("1")
  const [cStartsAt, setCStartsAt] = useState("")
  const [cExpires, setCExpires] = useState("")
  const [cTiers, setCTiers] = useState<string[]>([])
  const [cMinCart, setCMinCart] = useState("")
  const [cAllowedGeos, setCAllowedGeos] = useState("")
  const [cBlockedGeos, setCBlockedGeos] = useState("")
  const [cTargetSegment, setCTargetSegment] = useState("all")
  const [cRequiresSub, setCRequiresSub] = useState(false)
  const [cNewUsersOnly, setCNewUsersOnly] = useState(false)
  const [cAffiliateCode, setCAffilateCode] = useState("")
  const [cAffiliateCommission, setCAffilateCommission] = useState("")
  const [cActive, setCActive] = useState(true)

  // Bulk form
  const [bPrefix, setBPrefix] = useState("")
  const [bCount, setBCount] = useState("10")
  const [bType, setBType] = useState<CouponType>("PERCENTAGE")
  const [bVal, setBVal] = useState("")
  const [bMaxUses, setBMaxUses] = useState("1")
  const [bExpires, setBExpires] = useState("")
  const [bTiers, setBTiers] = useState<string[]>([])

  // Campaign form
  const [campName, setCampName] = useState("")
  const [campLabel, setCampLabel] = useState("")
  const [campDesc, setCampDesc] = useState("")
  const [campType, setCampType] = useState<CampaignType>("FESTIVAL")
  const [campStatus, setCampStatus] = useState<CampaignStatus>("DRAFT")
  const [campStarts, setCampStarts] = useState("")
  const [campEnds, setCampEnds] = useState("")
  const [campDiscount, setCampDiscount] = useState("")
  const [campFlatDiscount, setCampFlatDiscount] = useState("")
  const [campBanner, setCampBanner] = useState("")
  const [campBannerImage, setCampBannerImage] = useState("")
  const [campCtaText, setCampCtaText] = useState("")
  const [campCtaUrl, setCampCtaUrl] = useState("")
  const [campTiers, setCampTiers] = useState<string[]>([])
  const [campTargetSegment, setCampTargetSegment] = useState("all")
  const [campAllowedGeos, setCampAllowedGeos] = useState("")
  const [campActive, setCampActive] = useState(true)

  // ── Helper: countdown timer ─────────────────────────────────────────────────

  const formatTimeLeft = (dt: string) => {
    const total = Date.parse(dt) - now.getTime()
    if (total <= 0) return "Ended"
    const s = Math.floor((total / 1000) % 60)
    const m = Math.floor((total / 60000) % 60)
    const h = Math.floor((total / 3600000) % 24)
    const d = Math.floor(total / 86400000)
    return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`
  }

  // ── Reset / Open modal helpers ──────────────────────────────────────────────

  const openCouponModal = (mode: "create" | "edit", coupon?: Coupon) => {
    setActiveCoupon(coupon || null)
    setCouponModal(mode)
    if (mode === "edit" && coupon) {
      setCCode(coupon.code); setCName(coupon.name || ""); setCDesc(coupon.description || "")
      setCType(coupon.type); setCVal(String(coupon.discountValue)); setCCap(String(coupon.maxDiscountCap || ""))
      setCFreeCredits(String(coupon.freeCredits || "")); setCFreeTokens(String(coupon.freeTokens || ""))
      setCTrialDays(String(coupon.trialExtensionDays || ""))
      setCMaxUses(String(coupon.maxUses || "")); setCPerUser(String(coupon.perUserLimit || 1))
      setCStartsAt(coupon.startsAt ? coupon.startsAt.slice(0, 16) : "")
      setCExpires(coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : "")
      setCTiers(coupon.applicableTierIds); setCMinCart(String(coupon.minCartValue || ""))
      setCAllowedGeos((coupon.allowedGeos || []).join(", ")); setCBlockedGeos("")
      setCTargetSegment(coupon.targetSegment || "all")
      setCRequiresSub(coupon.requiresSubscription); setCNewUsersOnly(coupon.newUsersOnly)
      setCAffilateCode(coupon.affiliateCode || ""); setCAffilateCommission("")
      setCActive(coupon.isActive)
    } else {
      setCCode(""); setCName(""); setCDesc(""); setCType("PERCENTAGE"); setCVal(""); setCCap("")
      setCFreeCredits(""); setCFreeTokens(""); setCTrialDays(""); setCMaxUses(""); setCPerUser("1")
      setCStartsAt(""); setCExpires(""); setCTiers([]); setCMinCart("")
      setCAllowedGeos(""); setCBlockedGeos(""); setCTargetSegment("all")
      setCRequiresSub(false); setCNewUsersOnly(false); setCAffilateCode(""); setCAffilateCommission("")
      setCActive(true)
    }
  }

  const openCampaignModal = (mode: "create" | "edit", campaign?: Campaign) => {
    setActiveCampaign(campaign || null)
    setCampaignModal(mode)
    if (mode === "edit" && campaign) {
      setCampName(campaign.name); setCampLabel(campaign.label || ""); setCampDesc(campaign.description || "")
      setCampType(campaign.type); setCampStatus(campaign.status)
      setCampStarts(campaign.startsAt.slice(0, 16)); setCampEnds(campaign.endsAt.slice(0, 16))
      setCampDiscount(String(campaign.discountPercent)); setCampFlatDiscount(String(campaign.flatDiscount || ""))
      setCampBanner(campaign.bannerText || ""); setCampBannerImage(campaign.bannerImageUrl || "")
      setCampCtaText(campaign.ctaText || ""); setCampCtaUrl(campaign.ctaUrl || "")
      setCampTiers(campaign.applicableTierIds); setCampTargetSegment(campaign.targetSegment || "all")
      setCampAllowedGeos("")
      setCampActive(campaign.isActive)
    } else {
      setCampName(""); setCampLabel(""); setCampDesc(""); setCampType("FESTIVAL"); setCampStatus("DRAFT")
      setCampStarts(""); setCampEnds(""); setCampDiscount(""); setCampFlatDiscount("")
      setCampBanner(""); setCampBannerImage(""); setCampCtaText(""); setCampCtaUrl("")
      setCampTiers([]); setCampTargetSegment("all"); setCampAllowedGeos("")
      setCampActive(true)
    }
  }

  // ── Form submissions ─────────────────────────────────────────────────────────

  const handleSaveCoupon = async () => {
    if (!cCode || !cVal) return toast({ title: "Required fields missing", description: "Code and discount value are required.", variant: "destructive" })
    setLoading(true)
    try {
      const payload = {
        code: cCode, name: cName || null, description: cDesc || null, type: cType,
        discountValue: Number(cVal), maxDiscountCap: cCap ? Number(cCap) : null,
        freeCredits: cFreeCredits ? Number(cFreeCredits) : null,
        freeTokens: cFreeTokens ? Number(cFreeTokens) : null,
        trialExtensionDays: cTrialDays ? Number(cTrialDays) : null,
        maxUses: cMaxUses ? Number(cMaxUses) : null, perUserLimit: Number(cPerUser) || 1,
        expiresAt: cExpires || null, startsAt: cStartsAt || null,
        applicableTierIds: cTiers,
        minCartValue: cMinCart ? Number(cMinCart) : null,
        allowedGeos: cAllowedGeos.split(",").map(g => g.trim()).filter(Boolean),
        blockedGeos: cBlockedGeos.split(",").map(g => g.trim()).filter(Boolean),
        targetSegment: cTargetSegment || null,
        requiresSubscription: cRequiresSub, newUsersOnly: cNewUsersOnly,
        affiliateCode: cAffiliateCode || null,
        affiliateCommission: cAffiliateCommission ? Number(cAffiliateCommission) : null,
        isActive: cActive,
      }

      if (couponModal === "create") {
        const coupon = await createCoupon(payload)
        setCoupons(prev => [coupon as any, ...prev])
        toast({ title: "✅ Coupon Created", description: `Code "${coupon.code}" is ready.` })
      } else if (activeCoupon) {
        const coupon = await updateCoupon(activeCoupon.id, payload)
        setCoupons(prev => prev.map(c => c.id === activeCoupon.id ? { ...c, ...coupon as any } : c))
        toast({ title: "✅ Coupon Updated", description: "Changes saved." })
      }
      setCouponModal(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleBulkGenerate = async () => {
    if (!bPrefix || !bVal || !bCount) return toast({ title: "Required fields missing", description: "Prefix, count, and discount value are required.", variant: "destructive" })
    setLoading(true)
    try {
      const result = await bulkGenerateCoupons({ prefix: bPrefix, count: Number(bCount), type: bType, discountValue: Number(bVal), maxUses: bMaxUses ? Number(bMaxUses) : null, expiresAt: bExpires || null, applicableTierIds: bTiers })
      toast({ title: `✅ ${result.length} Coupons Generated`, description: `Codes starting with "${bPrefix.toUpperCase()}-" are ready.` })
      setCouponModal(null)
      router.refresh()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCampaign = async () => {
    if (!campName || !campStarts || !campEnds) return toast({ title: "Required fields missing", description: "Name, start and end dates required.", variant: "destructive" })
    setLoading(true)
    try {
      const payload = {
        name: campName, label: campLabel || null, description: campDesc || null,
        type: campType, status: campStatus,
        startsAt: campStarts, endsAt: campEnds,
        discountPercent: Number(campDiscount) || 0, flatDiscount: campFlatDiscount ? Number(campFlatDiscount) : null,
        bannerText: campBanner || null, bannerImageUrl: campBannerImage || null,
        ctaText: campCtaText || null, ctaUrl: campCtaUrl || null,
        applicableTierIds: campTiers, targetSegment: campTargetSegment || null,
        allowedGeos: campAllowedGeos.split(",").map(g => g.trim()).filter(Boolean),
        isActive: campActive,
      }

      if (campaignModal === "create") {
        const campaign = await createCampaign(payload)
        setCampaigns(prev => [campaign as any, ...prev])
        toast({ title: "✅ Campaign Created", description: `"${campaign.name}" has been scheduled.` })
      } else if (activeCampaign) {
        const campaign = await updateCampaign(activeCampaign.id, payload)
        setCampaigns(prev => prev.map(c => c.id === activeCampaign.id ? { ...c, ...campaign as any } : c))
        toast({ title: "✅ Campaign Updated", description: "Changes saved and website synchronized." })
      }
      setCampaignModal(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivateCoupon = async (reason: string) => {
    if (!deactivateTarget) return
    setLoading(true)
    try {
      await deactivateCouponAction(deactivateTarget.id, reason)
      setCoupons(prev => prev.map(c => c.id === deactivateTarget.id ? { ...c, isActive: false } : c))
      toast({ title: "Coupon Deactivated", description: `"${deactivateTarget.code}" has been disabled.` })
      setDeactivateTarget(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleKillCampaign = async (reason: string) => {
    if (!killCampaign) return
    setLoading(true)
    try {
      await toggleCampaign(killCampaign.id, false, reason)
      setCampaigns(prev => prev.map(c => c.id === killCampaign.id ? { ...c, isActive: false, status: "PAUSED" as CampaignStatus } : c))
      toast({ title: "Campaign Paused", description: `"${killCampaign.name}" stopped immediately.` })
      setKillCampaign(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleActivateCampaign = async (campaign: Campaign) => {
    try {
      await toggleCampaign(campaign.id, true)
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, isActive: true, status: "ACTIVE" as CampaignStatus } : c))
      toast({ title: "✅ Campaign Activated", description: `"${campaign.name}" is now live on the website.` })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleDuplicateCampaign = async (campaign: Campaign) => {
    try {
      const dup = await duplicateCampaign(campaign.id)
      setCampaigns(prev => [dup as any, ...prev])
      toast({ title: "✅ Campaign Duplicated", description: `"${campaign.name}" duplicated as Draft.` })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setLoading(true)
    try {
      if (deleteTarget.type === "coupon") {
        await deleteCoupon(deleteTarget.id)
        setCoupons(prev => prev.filter(c => c.id !== deleteTarget.id))
        toast({ title: "Deleted", description: `Coupon "${deleteTarget.name}" deleted.` })
      } else {
        await deleteCampaign(deleteTarget.id)
        setCampaigns(prev => prev.filter(c => c.id !== deleteTarget.id))
        toast({ title: "Deleted", description: `Campaign "${deleteTarget.name}" deleted.` })
      }
      setDeleteTarget(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const exportCouponReport = () => {
    const headers = ["Code", "Name", "Type", "Discount", "Used", "Max Uses", "Status", "Expires"]
    const rows = coupons.map(c => [c.code, c.name || "", c.type, formatDiscount(c), String(c.usedCount), String(c.maxUses || "Unlimited"), c.isActive ? "Active" : "Inactive", c.expiresAt || "Never"])
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n")
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = `coupons-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  // ── Filtered coupons ─────────────────────────────────────────────────────────

  const filteredCoupons = useMemo(() => coupons.filter(c => {
    const matchSearch = !couponSearch || c.code.toLowerCase().includes(couponSearch.toLowerCase()) || (c.name || "").toLowerCase().includes(couponSearch.toLowerCase())
    const matchType = couponTypeFilter === "ALL" || c.type === couponTypeFilter
    const matchStatus = couponStatusFilter === "ALL" || (couponStatusFilter === "ACTIVE" ? c.isActive : !c.isActive)
    return matchSearch && matchType && matchStatus
  }), [coupons, couponSearch, couponTypeFilter, couponStatusFilter])

  // ── Stats ─────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    activeCoupons: coupons.filter(c => c.isActive).length,
    totalUses: coupons.reduce((s, c) => s + c.usedCount, 0),
    liveCampaigns: campaigns.filter(c => c.isActive && c.status === "ACTIVE").length,
    scheduledCampaigns: campaigns.filter(c => c.status === "SCHEDULED").length,
  }), [coupons, campaigns])

  // ─── Tier checkbox helper ──────────────────────────────────────────────────────

  const toggleTier = (tierId: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(tierId) ? list.filter(id => id !== tierId) : [...list, tierId])
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Offers, Coupons & Campaigns</h1>
          <p className="text-sm text-muted-foreground">Enterprise promotion engine — create, schedule, and sync discount offers to the website in real-time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCouponReport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => openCouponModal("create")}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />New Coupon
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCouponModal("bulk")}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />Bulk Generate
          </Button>
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => openCampaignModal("create")}>
            <FlameKindling className="h-3.5 w-3.5 mr-1.5" />Launch Campaign
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Coupons", val: stats.activeCoupons, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20", icon: <Tag className="h-4 w-4" /> },
          { label: "Total Redemptions", val: stats.totalUses, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", icon: <CheckCircle className="h-4 w-4" /> },
          { label: "Live Campaigns", val: stats.liveCampaigns, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: <Play className="h-4 w-4" /> },
          { label: "Scheduled", val: stats.scheduledCampaigns, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", icon: <Clock className="h-4 w-4" /> },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} border border-border/60 rounded-xl p-3 flex items-center gap-3`}>
            <div className={`${stat.color} opacity-70`}>{stat.icon}</div>
            <div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.val}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        {[
          { id: "coupons" as const, label: "Promo Codes", count: coupons.length },
          { id: "campaigns" as const, label: "Campaigns", count: campaigns.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${activeTab === tab.id ? "border-violet-500 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
            <span className="text-xs bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* COUPONS TAB                                                                */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "coupons" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search coupon codes..." className="pl-9" value={couponSearch} onChange={e => setCouponSearch(e.target.value)} />
            </div>
            <select className="border border-input rounded-lg px-3 py-2 text-sm bg-background" value={couponTypeFilter} onChange={e => setCouponTypeFilter(e.target.value)}>
              <option value="ALL">All Types</option>
              {Object.entries(COUPON_TYPE_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
            </select>
            <select className="border border-input rounded-lg px-3 py-2 text-sm bg-background" value={couponStatusFilter} onChange={e => setCouponStatusFilter(e.target.value)}>
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Coupons Table */}
          <div className="border border-border/60 rounded-2xl overflow-hidden bg-card shadow-sm">
            {filteredCoupons.length === 0 ? (
              <div className="py-16 text-center">
                <Tag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No coupons found. Create your first coupon.</p>
                <Button size="sm" className="mt-4" onClick={() => openCouponModal("create")}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Create Coupon
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30">
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Code & Details</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type & Offer</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Restrictions</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Usage</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Validity</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredCoupons.map(coupon => {
                      const tc = COUPON_TYPE_CONFIG[coupon.type]
                      const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < now
                      const usagePercent = coupon.maxUses ? Math.min(100, (coupon.usedCount / coupon.maxUses) * 100) : 0

                      return (
                        <tr key={coupon.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-mono font-bold text-violet-600 dark:text-violet-400 text-base tracking-widest">{coupon.code}</p>
                            {coupon.name && <p className="text-xs text-muted-foreground mt-0.5">{coupon.name}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.color}`}>
                              {tc.label}
                            </span>
                            <p className="text-sm font-semibold mt-1">{formatDiscount(coupon)}</p>
                            {coupon.maxDiscountCap && <p className="text-[10px] text-muted-foreground">Cap: ${coupon.maxDiscountCap}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs space-y-0.5 text-muted-foreground">
                            {coupon.newUsersOnly && <p className="flex items-center gap-1 text-cyan-600"><Star className="h-2.5 w-2.5" />New users only</p>}
                            {coupon.requiresSubscription && <p className="flex items-center gap-1 text-purple-600"><CheckCircle className="h-2.5 w-2.5" />Subscribers only</p>}
                            {(coupon.allowedGeos || []).length > 0 && <p className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{(coupon.allowedGeos || []).join(", ")}</p>}
                            {coupon.minCartValue && <p>Min. ${coupon.minCartValue}</p>}
                            {coupon.applicableTierIds.length > 0 && <p>{coupon.applicableTierIds.length} plan(s)</p>}
                            {!coupon.newUsersOnly && !coupon.requiresSubscription && coupon.applicableTierIds.length === 0 && <p className="text-[10px]">All users, all plans</p>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{coupon.usedCount}</span>
                              <span className="text-muted-foreground text-xs">/ {coupon.maxUses || "∞"}</span>
                            </div>
                            {coupon.maxUses && (
                              <div className="mt-1 w-20 h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${usagePercent}%` }} />
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">{coupon.perUserLimit}/user</p>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {coupon.startsAt && <p className="text-muted-foreground">From {new Date(coupon.startsAt).toLocaleDateString()}</p>}
                            {coupon.expiresAt ? (
                              <p className={isExpired ? "text-red-500 font-medium" : "text-muted-foreground"}>
                                {isExpired ? "Expired" : "Expires"} {new Date(coupon.expiresAt).toLocaleDateString()}
                              </p>
                            ) : (
                              <p className="text-muted-foreground">No expiry</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${coupon.isActive && !isExpired ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                              {coupon.isActive && !isExpired ? "Active" : isExpired ? "Expired" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openCouponModal("edit", coupon)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              {coupon.isActive && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600" onClick={() => setDeactivateTarget(coupon)}>
                                  <Pause className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => setDeleteTarget({ type: "coupon", id: coupon.id, name: coupon.code })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* CAMPAIGNS TAB                                                              */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "campaigns" && (
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <div className="border-2 border-dashed border-border/60 rounded-2xl py-16 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No campaigns yet. Launch your first campaign.</p>
              <Button className="mt-4 bg-violet-600 hover:bg-violet-700 text-white" onClick={() => openCampaignModal("create")}>
                <FlameKindling className="h-4 w-4 mr-1.5" />Launch Campaign
              </Button>
            </div>
          ) : (
            campaigns.map(camp => {
              const nowT = now.getTime()
              const start = new Date(camp.startsAt).getTime()
              const end = new Date(camp.endsAt).getTime()
              const isLive = camp.isActive && camp.status === "ACTIVE" && nowT >= start && nowT <= end
              const isUpcoming = camp.status === "SCHEDULED" || (camp.isActive && nowT < start)
              const tc = CAMPAIGN_TYPE_CONFIG[camp.type]
              const sc = CAMPAIGN_STATUS_CONFIG[camp.status]

              return (
                <div key={camp.id} className={`border rounded-2xl bg-card overflow-hidden transition-all ${isLive ? "border-emerald-500/40 shadow-emerald-100 dark:shadow-emerald-900/20 shadow-md" : "border-border/60"}`}>
                  {isLive && (
                    <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-emerald-200/50 dark:border-emerald-800/30 px-4 py-1.5 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">LIVE — Actively running on website</span>
                      <span className="ml-auto font-mono text-xs text-emerald-700 dark:text-emerald-400">⏱ {formatTimeLeft(camp.endsAt)} remaining</span>
                    </div>
                  )}

                  <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="text-2xl w-10 text-center">{tc.emoji}</div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-base">{camp.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.color}`}>{tc.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                        {camp.label && <span className="text-[10px] border border-border/60 px-1.5 py-0.5 rounded font-mono text-muted-foreground">{camp.label}</span>}
                      </div>

                      {camp.description && <p className="text-xs text-muted-foreground mt-1">{camp.description}</p>}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {camp.discountPercent > 0 && <span className="font-semibold text-emerald-600">{camp.discountPercent}% Off</span>}
                        {camp.flatDiscount && <span className="font-semibold text-emerald-600">${camp.flatDiscount} Off</span>}
                        <span>📅 {new Date(camp.startsAt).toLocaleString()} → {new Date(camp.endsAt).toLocaleString()}</span>
                        {camp.targetSegment && <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{camp.targetSegment}</span>}
                        {camp.applicableTierIds.length > 0 && <span>{camp.applicableTierIds.length} plan(s)</span>}
                      </div>

                      {camp.bannerText && (
                        <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                          📢 Banner: "{camp.bannerText}"
                        </div>
                      )}

                      {/* Analytics mini */}
                      {(camp.impressions > 0 || camp.conversions > 0) && (
                        <div className="flex gap-4 mt-2 text-xs">
                          <span className="text-muted-foreground">{camp.impressions.toLocaleString()} impressions</span>
                          <span className="text-muted-foreground">{camp.clicks.toLocaleString()} clicks</span>
                          <span className="text-emerald-600 font-medium">{camp.conversions.toLocaleString()} conversions</span>
                          {Number(camp.revenue) > 0 && <span className="text-emerald-600 font-medium">${Number(camp.revenue).toFixed(2)} revenue</span>}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!camp.isActive && camp.status !== "ENDED" && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8" onClick={() => handleActivateCampaign(camp)}>
                          <Play className="h-3 w-3 mr-1" />Activate
                        </Button>
                      )}
                      {isLive && (
                        <Button variant="destructive" size="sm" className="text-xs h-8" onClick={() => setKillCampaign(camp)}>
                          <AlertOctagon className="h-3 w-3 mr-1" />Kill
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => openCampaignModal("edit", camp)}>
                        <Edit className="h-3 w-3 mr-1" />Edit
                      </Button>
                      <div className="relative group/menu">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                        <div className="absolute right-0 top-full mt-1 w-40 bg-popover border border-border rounded-xl shadow-xl z-20 py-1 opacity-0 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:pointer-events-auto transition-all">
                          <button onClick={() => handleDuplicateCampaign(camp)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"><Copy className="h-3.5 w-3.5" />Duplicate</button>
                          <div className="border-t border-border/60 my-1" />
                          <button onClick={() => setDeleteTarget({ type: "campaign", id: camp.id, name: camp.name })} className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* COUPON FORM MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {couponModal && couponModal !== "bulk" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{couponModal === "create" ? "Create Promotion Code" : `Edit: ${activeCoupon?.code}`}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Server-side validated. Automatically syncs to checkout.</p>
              </div>
              <button onClick={() => setCouponModal(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-violet-600 border-b pb-2">Core Settings</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Promo Code *</label>
                      <Input value={cCode} onChange={e => setCCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME50" className="mt-1 font-mono font-bold tracking-widest" disabled={couponModal === "edit"} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Display Name</label>
                      <Input value={cName} onChange={e => setCName(e.target.value)} placeholder="e.g. New User Welcome Offer" className="mt-1" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Description (internal)</label>
                    <Input value={cDesc} onChange={e => setCDesc(e.target.value)} placeholder="For marketing team notes" className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Coupon Type</label>
                    <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={cType} onChange={e => setCType(e.target.value as CouponType)}>
                      {Object.entries(COUPON_TYPE_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label} — {cfg.description}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">
                        {cType === "PERCENTAGE" ? "Discount %" : cType === "FLAT" ? "Flat Amount ($)" : cType === "FREE_CREDITS" ? "Credits" : cType === "FREE_TOKENS" ? "Tokens" : "Value"}
                      </label>
                      <Input type="number" value={cVal} onChange={e => setCVal(e.target.value)} placeholder={cType === "PERCENTAGE" ? "15" : "10"} className="mt-1 font-mono" />
                    </div>
                    {(cType === "PERCENTAGE" || cType === "FLAT") && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Max Discount Cap ($)</label>
                        <Input type="number" value={cCap} onChange={e => setCCap(e.target.value)} placeholder="No cap" className="mt-1" />
                      </div>
                    )}
                    {cType === "TRIAL_EXTENSION" && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Extra Trial Days</label>
                        <Input type="number" value={cTrialDays} onChange={e => setCTrialDays(e.target.value)} placeholder="14" className="mt-1" />
                      </div>
                    )}
                    {cType === "FREE_CREDITS" && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Credits Amount</label>
                        <Input type="number" value={cFreeCredits} onChange={e => setCFreeCredits(e.target.value)} placeholder="100" className="mt-1" />
                      </div>
                    )}
                    {cType === "FREE_TOKENS" && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Token Amount</label>
                        <Input type="number" value={cFreeTokens} onChange={e => setCFreeTokens(e.target.value)} placeholder="10000" className="mt-1" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Starts At</label>
                      <Input type="datetime-local" value={cStartsAt} onChange={e => setCStartsAt(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Expires At</label>
                      <Input type="datetime-local" value={cExpires} onChange={e => setCExpires(e.target.value)} className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Max Total Uses</label>
                      <Input type="number" value={cMaxUses} onChange={e => setCMaxUses(e.target.value)} placeholder="Unlimited" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Per-User Limit</label>
                      <Input type="number" value={cPerUser} onChange={e => setCPerUser(e.target.value)} placeholder="1" className="mt-1" />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
                    <input type="checkbox" checked={cActive} onChange={e => setCActive(e.target.checked)} className="w-4 h-4 rounded" />
                    Active (immediately available)
                  </label>
                </div>

                {/* Right */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-emerald-600 border-b pb-2">Targeting & Restrictions</h3>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Target Segment</label>
                    <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={cTargetSegment} onChange={e => setCTargetSegment(e.target.value)}>
                      <option value="all">All Users</option>
                      <option value="new_users">New Users Only</option>
                      <option value="returning_users">Returning Users</option>
                      <option value="subscribers">Active Subscribers</option>
                      <option value="churned">Churned Users (Retention)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Min. Cart Value ($)</label>
                    <Input type="number" value={cMinCart} onChange={e => setCMinCart(e.target.value)} placeholder="No minimum" className="mt-1" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Allowed Geos (comma)</label>
                      <Input value={cAllowedGeos} onChange={e => setCAllowedGeos(e.target.value)} placeholder="IN, US, GB" className="mt-1 font-mono text-xs" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Blocked Geos (comma)</label>
                      <Input value={cBlockedGeos} onChange={e => setCBlockedGeos(e.target.value)} placeholder="CN, RU" className="mt-1 font-mono text-xs" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={cNewUsersOnly} onChange={e => setCNewUsersOnly(e.target.checked)} className="w-4 h-4 rounded" />
                      New users only (first purchase)
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={cRequiresSub} onChange={e => setCRequiresSub(e.target.checked)} className="w-4 h-4 rounded" />
                      Requires active subscription
                    </label>
                  </div>

                  {(cType === "INFLUENCER" || cType === "AFFILIATE") && (
                    <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Affiliate/Influencer Code</label>
                        <Input value={cAffiliateCode} onChange={e => setCAffilateCode(e.target.value)} placeholder="e.g. JOHN_TECH" className="mt-1 font-mono" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Commission %</label>
                        <Input type="number" value={cAffiliateCommission} onChange={e => setCAffilateCommission(e.target.value)} placeholder="10" className="mt-1" />
                      </div>
                    </div>
                  )}

                  <div className="border-t border-border pt-3">
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Restrict to Pricing Plans</label>
                    <div className="border border-border/60 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1.5 bg-muted/10">
                      {productTiers.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No pricing plans found</p>
                      ) : productTiers.map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5">
                          <input type="checkbox" checked={cTiers.includes(t.id)} onChange={() => toggleTier(t.id, cTiers, setCTiers)} className="w-3.5 h-3.5 rounded" />
                          <span>[{t.productName}] <span className="font-semibold">{t.name}</span></span>
                        </label>
                      ))}
                    </div>
                    {cTiers.length === 0 && <p className="text-[10px] text-muted-foreground mt-1">Empty = applies to all plans</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Server-side validated on each checkout. Fraud-safe.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCouponModal(null)}>Cancel</Button>
                <Button onClick={handleSaveCoupon} disabled={loading || !cCode || !cVal} className="bg-violet-600 hover:bg-violet-700 text-white">
                  {loading ? "Saving..." : couponModal === "create" ? "Create Coupon" : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* BULK GENERATE MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {couponModal === "bulk" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Bulk Generate Coupons</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Generate up to 500 unique coupon codes at once.</p>
              </div>
              <button onClick={() => setCouponModal(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Code Prefix</label>
                <Input value={bPrefix} onChange={e => setBPrefix(e.target.value.toUpperCase())} placeholder="e.g. INFLUENCER" className="mt-1 font-mono" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Result: INFLUENCER-AB3XY2</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Quantity (max 500)</label>
                <Input type="number" value={bCount} onChange={e => setBCount(e.target.value)} max={500} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Type</label>
                <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={bType} onChange={e => setBType(e.target.value as CouponType)}>
                  <option value="PERCENTAGE">Percentage Off</option>
                  <option value="FLAT">Flat Discount</option>
                  <option value="FREE_CREDITS">Free Credits</option>
                  <option value="FREE_TOKENS">Free Tokens</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="INFLUENCER">Influencer</option>
                  <option value="AFFILIATE">Affiliate</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Discount Value</label>
                <Input type="number" value={bVal} onChange={e => setBVal(e.target.value)} placeholder="e.g. 20" className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Max Uses Per Code</label>
                <Input type="number" value={bMaxUses} onChange={e => setBMaxUses(e.target.value)} placeholder="1" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Expiration Date</label>
                <Input type="datetime-local" value={bExpires} onChange={e => setBExpires(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Applicable Plans</label>
              <div className="border border-border/60 rounded-xl p-3 max-h-32 overflow-y-auto space-y-1.5">
                {productTiers.map(t => (
                  <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={bTiers.includes(t.id)} onChange={() => toggleTier(t.id, bTiers, setBTiers)} />
                    [{t.productName}] <span className="font-semibold">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setCouponModal(null)}>Cancel</Button>
              <Button onClick={handleBulkGenerate} disabled={loading || !bPrefix || !bVal} className="bg-violet-600 hover:bg-violet-700 text-white">
                {loading ? "Generating..." : `Generate ${bCount} Codes`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* CAMPAIGN FORM MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {campaignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><FlameKindling className="h-5 w-5 text-orange-500" />{campaignModal === "create" ? "Launch New Campaign" : `Edit: ${activeCampaign?.name}`}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Campaigns auto-sync banners, pricing, checkout discounts, and recommendation systems.</p>
              </div>
              <button onClick={() => setCampaignModal(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-orange-600 border-b pb-2">Campaign Details</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Campaign Name *</label>
                      <Input value={campName} onChange={e => setCampName(e.target.value)} placeholder="e.g. Summer Flash Sale 2025" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Internal Label</label>
                      <Input value={campLabel} onChange={e => setCampLabel(e.target.value)} placeholder="e.g. SUMMER_2025" className="mt-1 font-mono text-xs" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
                    <Input value={campDesc} onChange={e => setCampDesc(e.target.value)} placeholder="Internal notes about this campaign" className="mt-1" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Campaign Type</label>
                      <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={campType} onChange={e => setCampType(e.target.value as CampaignType)}>
                        {Object.entries(CAMPAIGN_TYPE_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.emoji} {cfg.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Status</label>
                      <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={campStatus} onChange={e => setCampStatus(e.target.value as CampaignStatus)}>
                        {Object.entries(CAMPAIGN_STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Start Date & Time *</label>
                      <Input type="datetime-local" value={campStarts} onChange={e => setCampStarts(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">End Date & Time *</label>
                      <Input type="datetime-local" value={campEnds} onChange={e => setCampEnds(e.target.value)} className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Discount Percent (%)</label>
                      <Input type="number" value={campDiscount} onChange={e => setCampDiscount(e.target.value)} placeholder="e.g. 20" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Flat Discount ($)</label>
                      <Input type="number" value={campFlatDiscount} onChange={e => setCampFlatDiscount(e.target.value)} placeholder="e.g. 10" className="mt-1" />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={campActive} onChange={e => setCampActive(e.target.checked)} className="w-4 h-4 rounded" />
                    Activate immediately (reflects on website now)
                  </label>
                </div>

                {/* Right */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-blue-600 border-b pb-2">Website Display & Targeting</h3>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Banner Text (shown site-wide)</label>
                    <Input value={campBanner} onChange={e => setCampBanner(e.target.value)} placeholder="⚡ FLASH SALE: 20% off all plans this weekend!" className="mt-1" />
                    {campBanner && (
                      <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300/60 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                        📢 {campBanner}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Banner Image URL</label>
                    <Input value={campBannerImage} onChange={e => setCampBannerImage(e.target.value)} placeholder="https://cdn.example.com/sale-banner.jpg" className="mt-1 font-mono text-xs" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">CTA Button Text</label>
                      <Input value={campCtaText} onChange={e => setCampCtaText(e.target.value)} placeholder="Shop Now" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">CTA URL</label>
                      <Input value={campCtaUrl} onChange={e => setCampCtaUrl(e.target.value)} placeholder="/pricing" className="mt-1 font-mono text-xs" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Target Segment</label>
                    <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={campTargetSegment} onChange={e => setCampTargetSegment(e.target.value)}>
                      <option value="all">All Users</option>
                      <option value="new_users">New Users</option>
                      <option value="returning_users">Returning Users</option>
                      <option value="subscribers">Active Subscribers</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Allowed Geos (empty = worldwide)</label>
                    <Input value={campAllowedGeos} onChange={e => setCampAllowedGeos(e.target.value)} placeholder="IN, US, GB (or leave empty for all)" className="mt-1 font-mono text-xs" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Applicable Plans</label>
                    <div className="border border-border/60 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1.5">
                      {productTiers.map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5">
                          <input type="checkbox" checked={campTiers.includes(t.id)} onChange={() => toggleTier(t.id, campTiers, setCampTiers)} />
                          [{t.productName}] <span className="font-semibold">{t.name}</span>
                        </label>
                      ))}
                    </div>
                    {campTiers.length === 0 && <p className="text-[10px] text-muted-foreground mt-1">Empty = all plans</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Campaign auto-syncs to homepage banners, pricing cards, checkout, and recommendations.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCampaignModal(null)}>Cancel</Button>
                <Button onClick={handleSaveCampaign} disabled={loading || !campName || !campStarts || !campEnds} className="bg-orange-600 hover:bg-orange-700 text-white">
                  {loading ? "Saving..." : campaignModal === "create" ? "Launch Campaign" : "Save Campaign"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* CONFIRM DIALOGS */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivateCoupon}
        title="Deactivate Coupon"
        description={`Deactivate coupon "${deactivateTarget?.code}"? Users won't be able to use it anymore. Enter a reason:`}
        destructive
      />

      <ConfirmDialog
        open={!!killCampaign}
        onClose={() => setKillCampaign(null)}
        onConfirm={handleKillCampaign}
        title="Kill Campaign — Emergency Stop"
        description={`WARNING: This will instantly stop "${killCampaign?.name}" and remove all active discounts from the website. Users mid-checkout may be affected. Enter reason:`}
        destructive
      />

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold">Delete {deleteTarget.type === "coupon" ? "Coupon" : "Campaign"}</h3>
                <p className="text-sm text-muted-foreground mt-1">This permanently deletes <strong>"{deleteTarget.name}"</strong>. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>{loading ? "Deleting..." : "Delete Permanently"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
