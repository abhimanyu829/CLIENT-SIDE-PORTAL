"use client"

import { useState, useCallback, useRef, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ProductStatus, ProductType, BillingInterval } from "@prisma/client"
import {
  createProduct, updateProduct, createTier, updateTier,
  updateProductStatus, toggleProductBadge, deleteProduct,
  updateProductSEO, restoreProductVersion, addProductVersion,
  deleteTier, duplicateProduct, republishProduct
} from "./actions"
import {
  Package, Plus, Settings2, Tag, Eye, EyeOff, Edit, X,
  Globe, Sparkles, DollarSign, Star, Zap, Crown, TrendingUp,
  Pin, AlertTriangle, Archive, RotateCcw, Copy, Trash2,
  ChevronDown, ChevronUp, History, Search, Filter, MoreVertical,
  CheckCircle, Clock, Image, Video, FileText, Code2, Shield,
  Users, Database, Cpu, BarChart2, ExternalLink, ArrowUpRight,
  RefreshCw, Upload, Link, Check, Info, FlameKindling, Award,
  Calendar, CalendarDays, Infinity, CreditCard, Lock, XCircle
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TierLimits {
  apiQuota?: number
  tokenLimit?: number
  seatLimit?: number
  storageGB?: number
  featureFlags?: string[]
  regionalPricing?: Record<string, number>
  aiConfig?: { model: string; tokenMultiplier: number }
  customLimits?: Record<string, string | number | boolean>
}

interface Tier {
  id: string
  name: string
  description?: string | null
  price: number
  discountPrice?: number | null
  currency: string
  interval: BillingInterval
  features: string[]
  limits: TierLimits | null
  trialDays: number
  introPrice?: number | null
  introPeriodDays: number
  flashSalePrice?: number | null
  flashSaleEndsAt?: string | null
  taxRate: number
  taxInclusive: boolean
  setupFee?: number | null
  maxSeats?: number | null
  minSeats: number
  isPopular: boolean
  isRecommended: boolean
  isActive: boolean
  sortOrder: number
  version: number
}

interface ProductVersion {
  id: string
  version: number
  changedByName?: string | null
  changeNote?: string | null
  createdAt: string
  snapshot: any
}

interface Product {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  longDescription?: string | null
  type: ProductType
  category?: string | null
  subcategory?: string | null
  thumbnailUrl?: string | null
  iconUrl?: string | null
  bannerUrl?: string | null
  screenshotUrls: string[]
  videoUrls?: string[]
  demoUrl?: string | null
  documentationUrl?: string | null
  previewEnabled: boolean
  previewConfig?: any
  tags?: string[]
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string[]
  status: ProductStatus
  scheduledAt?: string | null
  isPremium: boolean
  proPoints: number
  isFeatured: boolean
  isPinned: boolean
  isTrending: boolean
  isBestSeller: boolean
  badgeText?: string | null
  version: number
  tiers: Tier[]
  versions?: ProductVersion[]
  assignedUserId?: string | null
  assignedEmail?: string | null
  reservedUntil?: Date | null
}

interface Props {
  initialProducts: Product[]
}

// ─── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProductStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: "Draft", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: <Edit className="h-3 w-3" /> },
  AVAILABLE: { label: "Available", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <CheckCircle className="h-3 w-3" /> },
  RESERVED: { label: "Reserved", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: <Lock className="h-3 w-3" /> },
  EXPIRED: { label: "Expired", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="h-3 w-3" /> },
  REPUBLISH_PENDING: { label: "Republish Queue", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: <RefreshCw className="h-3 w-3" /> },
  SCHEDULED: { label: "Scheduled", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: <Clock className="h-3 w-3" /> },
  ARCHIVED: { label: "Archived", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", icon: <Archive className="h-3 w-3" /> },
  HIDDEN: { label: "Hidden", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: <EyeOff className="h-3 w-3" /> },
  MAINTENANCE: { label: "Maintenance", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: <AlertTriangle className="h-3 w-3" /> },
}

const PRODUCT_TYPES: { value: ProductType; label: string; icon: string; category: string }[] = [
  { value: "SAAS", label: "SaaS Platform", icon: "💻", category: "Software" },
  { value: "AI_AGENT", label: "AI Agent", icon: "🤖", category: "AI" },
  { value: "AI_TOOL", label: "AI Tool", icon: "✨", category: "AI" },
  { value: "API", label: "API Service", icon: "🔌", category: "Developer" },
  { value: "AUTOMATION", label: "Automation", icon: "⚡", category: "Productivity" },
  { value: "WEBSITE", label: "Website Service", icon: "🌐", category: "Services" },
  { value: "DIGITAL", label: "Digital Product", icon: "📦", category: "Digital" },
  { value: "ADDON", label: "Addon / Extension", icon: "🧩", category: "Add-ons" },
  { value: "CREDIT_PACK", label: "Credit Pack", icon: "💎", category: "Credits" },
  { value: "ENTERPRISE", label: "Enterprise Solution", icon: "🏢", category: "Enterprise" },
  { value: "SERVICE", label: "Service", icon: "🛠️", category: "Services" },
  { value: "CUSTOM", label: "Custom Product", icon: "🎯", category: "Custom" },
]

const BILLING_INTERVALS: { value: BillingInterval; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "ONE_TIME", label: "One-Time" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "LIFETIME", label: "Lifetime Deal" },
  { value: "PER_SEAT", label: "Per Seat / Month" },
  { value: "USAGE_BASED", label: "Usage-Based" },
  { value: "TOKEN_BASED", label: "Token-Based" },
]

const CATEGORIES = ["SaaS", "AI & ML", "Automation", "APIs", "Services", "Digital Products", "Addons", "Credits", "Enterprise", "Other"]

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function normalizeProduct(product: Partial<Product>, fallback?: Product): Product {
  return {
    ...(fallback as Product | undefined),
    ...(product as Product),
    tags: product.tags ?? fallback?.tags ?? [],
    screenshotUrls: product.screenshotUrls ?? fallback?.screenshotUrls ?? [],
    videoUrls: product.videoUrls ?? fallback?.videoUrls ?? [],
    seoKeywords: product.seoKeywords ?? fallback?.seoKeywords ?? [],
    tiers: product.tiers ?? fallback?.tiers ?? [],
    versions: product.versions ?? fallback?.versions ?? [],
  } as Product
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function AdminProductsClient({ initialProducts }: Props) {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>(() => initialProducts.map(product => normalizeProduct(product)))
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("ALL")
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  // Modal states
  const [productModal, setProductModal] = useState<"create" | "edit" | null>(null)
  const [tierModal, setTierModal] = useState<{ mode: "create" | "edit"; productId: string; data?: Tier } | null>(null)
  const [seoModal, setSeoModal] = useState<{ product: Product } | null>(null)
  const [historyModal, setHistoryModal] = useState<{ product: Product } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ productId: string; name: string } | null>(null)
  const [activeProduct, setActiveProduct] = useState<Product | null>(null)
  const [activeTab, setActiveTab] = useState<"basic" | "media" | "pricing" | "features" | "seo">("basic")

  // Product form
  const [pName, setPName] = useState("")
  const [pSlug, setPSlug] = useState("")
  const [pTagline, setPTagline] = useState("")
  const [pDesc, setPDesc] = useState("")
  const [pLongDesc, setPLongDesc] = useState("")
  const [pType, setPType] = useState<ProductType>("SAAS")
  const [pCategory, setPCategory] = useState("")
  const [pSubcategory, setPSubcategory] = useState("")
  const [pStatus, setPStatus] = useState<ProductStatus>("DRAFT")
  const [pScheduledAt, setPScheduledAt] = useState("")
  const [pIsPremium, setPIsPremium] = useState(false)
  const [pPoints, setPPoints] = useState(0)
  const [pTags, setPTags] = useState("")
  const [pThumbnail, setPThumbnail] = useState("")
  const [pIcon, setPIcon] = useState("")
  const [pBanner, setPBanner] = useState("")
  const [pScreenshots, setPScreenshots] = useState("")
  const [pVideos, setPVideos] = useState("")
  const [pDemoUrl, setPDemoUrl] = useState("")
  const [pDocUrl, setPDocUrl] = useState("")
  const [pPreviewEnabled, setPPreviewEnabled] = useState(false)
  const [pPreviewConfig, setPPreviewConfig] = useState<any>(null)
  const [pSeoTitle, setPSeoTitle] = useState("")
  const [pSeoDesc, setPSeoDesc] = useState("")
  const [pSeoKeywords, setPSeoKeywords] = useState("")
  const [pBadgeText, setPBadgeText] = useState("")
  const [pVersionNote, setPVersionNote] = useState("")

  // Tier form
  const [tName, setTName] = useState("")
  const [tDesc, setTDesc] = useState("")
  const [tPrice, setTPrice] = useState("")
  const [tDiscountPrice, setTDiscountPrice] = useState("")
  const [tCurrency, setTCurrency] = useState("USD")
  const [tInterval, setTInterval] = useState<BillingInterval>("MONTHLY")
  const [tFeatures, setTFeatures] = useState("")
  const [tIsPopular, setTIsPopular] = useState(false)
  const [tIsRecommended, setTIsRecommended] = useState(false)
  const [tIsActive, setTIsActive] = useState(true)
  const [tTrialDays, setTTrialDays] = useState("0")
  const [tIntroPrice, setTIntroPrice] = useState("")
  const [tIntroDays, setTIntroDays] = useState("")
  const [tFlashPrice, setTFlashPrice] = useState("")
  const [tFlashEnds, setTFlashEnds] = useState("")
  const [tTaxRate, setTTaxRate] = useState("0")
  const [tTaxInclusive, setTTaxInclusive] = useState(false)
  const [tSetupFee, setTSetupFee] = useState("")
  const [tMaxSeats, setTMaxSeats] = useState("")
  const [tApiQuota, setTApiQuota] = useState("")
  const [tTokenLimit, setTTokenLimit] = useState("")
  const [tSeatLimit, setTSeatLimit] = useState("")
  const [tStorageGB, setTStorageGB] = useState("")
  const [tFlags, setTFlags] = useState("")
  const [tRegINR, setTRegINR] = useState("")
  const [tRegEUR, setTRegEUR] = useState("")
  const [tRegGBP, setTRegGBP] = useState("")
  const [tAiModel, setTAiModel] = useState("")
  const [tAiMult, setTAiMult] = useState("1")
  const [tPriceNote, setTPriceNote] = useState("")
  const [tSortOrder, setTSortOrder] = useState("0")
  const [tStripePriceId, setTStripePriceId] = useState("")
  const [tStripeProductId, setTStripeProductId] = useState("")
  const [tRazorpayPlanId, setTRazorpayPlanId] = useState("")

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const filteredProducts = products.filter(p => {
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.slug.toLowerCase().includes(searchQuery.toLowerCase())
    const matchType = filterType === "ALL" || p.type === filterType
    const matchStatus = filterStatus === "ALL" || p.status === filterStatus
    return matchSearch && matchType && matchStatus
  })

  const toggleExpand = (id: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const openProductModal = (mode: "create" | "edit", product?: Product) => {
    setProductModal(mode)
    setActiveTab("basic")
    if (mode === "edit" && product) {
      setActiveProduct(product)
      setPName(product.name)
      setPSlug(product.slug)
      setPTagline(product.tagline || "")
      setPDesc(product.description || "")
      setPLongDesc(product.longDescription || "")
      setPType(product.type)
      setPCategory(product.category || "")
      setPSubcategory(product.subcategory || "")
      setPStatus(product.status)
      setPScheduledAt(product.scheduledAt || "")
      setPIsPremium(product.isPremium)
      setPPoints(product.proPoints)
      setPTags((product.tags || []).join(", "))
      setPThumbnail(product.thumbnailUrl || "")
      setPIcon(product.iconUrl || "")
      setPBanner(product.bannerUrl || "")
      setPScreenshots((product.screenshotUrls || []).join(", "))
      setPVideos((product.videoUrls || []).join(", "))
      setPDemoUrl(product.demoUrl || "")
      setPDocUrl(product.documentationUrl || "")
      setPPreviewEnabled(product.previewEnabled || false)
      setPPreviewConfig(product.previewConfig || null)
      setPSeoTitle(product.seoTitle || "")
      setPSeoDesc(product.seoDescription || "")
      setPSeoKeywords((product.seoKeywords || []).join(", "))
      setPBadgeText(product.badgeText || "")
      setPVersionNote("")
    } else {
      setActiveProduct(null)
      setPName(""); setPSlug(""); setPTagline(""); setPDesc(""); setPLongDesc("")
      setPType("SAAS"); setPCategory(""); setPSubcategory(""); setPStatus("DRAFT"); setPScheduledAt("")
      setPIsPremium(false); setPPoints(0); setPTags("")
      setPThumbnail(""); setPIcon(""); setPBanner(""); setPScreenshots(""); setPVideos("")
      setPDemoUrl(""); setPDocUrl(""); setPPreviewEnabled(false); setPPreviewConfig(null)
      setPSeoTitle(""); setPSeoDesc(""); setPSeoKeywords(""); setPBadgeText("")
      setPVersionNote("")
    }
  }

  const openTierModal = (mode: "create" | "edit", productId: string, tier?: Tier) => {
    setTierModal({ mode, productId, data: tier })
    if (mode === "edit" && tier) {
      setTName(tier.name); setTDesc(tier.description || "")
      setTPrice(String(tier.price)); setTDiscountPrice(String(tier.discountPrice || ""))
      setTCurrency(tier.currency); setTInterval(tier.interval)
      setTFeatures(tier.features.join("\n"))
      setTIsPopular(tier.isPopular); setTIsRecommended(tier.isRecommended); setTIsActive(tier.isActive)
      setTTrialDays(String(tier.trialDays || 0))
      setTIntroPrice(String(tier.introPrice || "")); setTIntroDays(String(tier.introPeriodDays || ""))
      setTFlashPrice(String(tier.flashSalePrice || "")); setTFlashEnds(tier.flashSaleEndsAt || "")
      setTTaxRate(String(tier.taxRate || 0)); setTTaxInclusive(tier.taxInclusive || false)
      setTSetupFee(String(tier.setupFee || "")); setTMaxSeats(String(tier.maxSeats || ""))
      setTApiQuota(String(tier.limits?.apiQuota || ""))
      setTTokenLimit(String(tier.limits?.tokenLimit || ""))
      setTSeatLimit(String(tier.limits?.seatLimit || ""))
      setTStorageGB(String(tier.limits?.storageGB || ""))
      setTFlags((tier.limits?.featureFlags || []).join(", "))
      setTRegINR(tier.limits?.regionalPricing?.INR?.toString() || "")
      setTRegEUR(tier.limits?.regionalPricing?.EUR?.toString() || "")
      setTRegGBP(tier.limits?.regionalPricing?.GBP?.toString() || "")
      setTAiModel(tier.limits?.aiConfig?.model || "")
      setTAiMult(String(tier.limits?.aiConfig?.tokenMultiplier || 1.0))
      setTPriceNote(""); setTSortOrder(String(tier.sortOrder || 0))
      setTStripePriceId((tier as any).stripePriceId || "")
      setTStripeProductId((tier as any).stripeProductId || "")
      setTRazorpayPlanId((tier as any).razorpayPlanId || "")
    } else {
      setTName(""); setTDesc(""); setTPrice(""); setTDiscountPrice("")
      setTCurrency("USD"); setTInterval("MONTHLY"); setTFeatures("")
      setTIsPopular(false); setTIsRecommended(false); setTIsActive(true)
      setTTrialDays("0"); setTIntroPrice(""); setTIntroDays("")
      setTFlashPrice(""); setTFlashEnds(""); setTTaxRate("0"); setTTaxInclusive(false)
      setTSetupFee(""); setTMaxSeats("")
      setTApiQuota(""); setTTokenLimit(""); setTSeatLimit(""); setTStorageGB(""); setTFlags("")
      setTRegINR(""); setTRegEUR(""); setTRegGBP("")
      setTAiModel(""); setTAiMult("1.0"); setTPriceNote(""); setTSortOrder("0")
      setTStripePriceId(""); setTStripeProductId(""); setTRazorpayPlanId("")
    }
  }

  // ─── Product Save ─────────────────────────────────────────────────────────────

  const saveProduct = async () => {
    setLoading(true)
    try {
      const payload = {
        name: pName, slug: pSlug, tagline: pTagline, description: pDesc,
        longDescription: pLongDesc || null,
        type: pType, category: pCategory || null, subcategory: pSubcategory || null,
        status: pStatus, scheduledAt: pScheduledAt || null,
        isPremium: pIsPremium, proPoints: Number(pPoints),
        tags: pTags.split(",").map(t => t.trim()).filter(Boolean),
        thumbnailUrl: pThumbnail || null, iconUrl: pIcon || null, bannerUrl: pBanner || null,
        screenshotUrls: pScreenshots.split(",").map(s => s.trim()).filter(Boolean),
        videoUrls: pVideos.split(",").map(v => v.trim()).filter(Boolean),
        demoUrl: pDemoUrl || null, documentationUrl: pDocUrl || null,
        previewEnabled: pPreviewEnabled, previewConfig: pPreviewConfig,
        seoTitle: pSeoTitle || null, seoDescription: pSeoDesc || null,
        seoKeywords: pSeoKeywords.split(",").map(k => k.trim()).filter(Boolean),
        badgeText: pBadgeText || null,
      }

      if (productModal === "create") {
        const created = await createProduct(payload)
        setProducts(prev => [normalizeProduct(created as any), ...prev])
        toast({ title: "✅ Product Created", description: `${created.name} has been created and is in ${created.status} mode.` })
      } else if (activeProduct) {
        await updateProduct(activeProduct.id, payload, pVersionNote || "Admin edit")
        setProducts(prev => prev.map(p => p.id === activeProduct.id ? normalizeProduct(payload as any, p) : p))
        toast({ title: "✅ Product Updated", description: "Changes saved and website cache revalidated." })
      }
      setProductModal(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // ─── Tier Save ────────────────────────────────────────────────────────────────

  const saveTier = async () => {
    setLoading(true)
    try {
      const limits: TierLimits = {}
      if (tApiQuota) limits.apiQuota = Number(tApiQuota)
      if (tTokenLimit) limits.tokenLimit = Number(tTokenLimit)
      if (tSeatLimit) limits.seatLimit = Number(tSeatLimit)
      if (tStorageGB) limits.storageGB = Number(tStorageGB)
      if (tFlags) limits.featureFlags = tFlags.split(",").map(f => f.trim()).filter(Boolean)
      const regional: Record<string, number> = {}
      if (tRegINR) regional.INR = Number(tRegINR)
      if (tRegEUR) regional.EUR = Number(tRegEUR)
      if (tRegGBP) regional.GBP = Number(tRegGBP)
      if (Object.keys(regional).length > 0) limits.regionalPricing = regional
      if (tAiModel) limits.aiConfig = { model: tAiModel, tokenMultiplier: Number(tAiMult) || 1.0 }

      const payload = {
        name: tName, description: tDesc || null,
        price: Number(tPrice), discountPrice: tDiscountPrice ? Number(tDiscountPrice) : null,
        currency: tCurrency, interval: tInterval,
        features: tFeatures.split("\n").map(f => f.trim()).filter(Boolean),
        limits: Object.keys(limits).length > 0 ? limits : null,
        trialDays: Number(tTrialDays) || 0,
        introPrice: tIntroPrice ? Number(tIntroPrice) : null,
        introPeriodDays: Number(tIntroDays) || 0,
        flashSalePrice: tFlashPrice ? Number(tFlashPrice) : null,
        flashSaleEndsAt: tFlashEnds || null,
        taxRate: Number(tTaxRate) || 0,
        taxInclusive: tTaxInclusive,
        setupFee: tSetupFee ? Number(tSetupFee) : null,
        maxSeats: tMaxSeats ? Number(tMaxSeats) : null,
        isPopular: tIsPopular, isRecommended: tIsRecommended, isActive: tIsActive,
        sortOrder: Number(tSortOrder),
        priceChangeReason: tPriceNote,
        stripePriceId: tStripePriceId || undefined,
        stripeProductId: tStripeProductId || undefined,
        razorpayPlanId: tRazorpayPlanId || undefined,
      }

      if (tierModal?.mode === "create" && tierModal.productId) {
        const tier = await createTier(tierModal.productId, payload)
        setProducts(prev => prev.map(p => p.id === tierModal.productId ? { ...p, tiers: [...(p.tiers ?? []), tier as any] } : p))
        toast({ title: "✅ Plan Created", description: `Plan "${tier.name}" added to product.` })
      } else if (tierModal?.mode === "edit" && tierModal.data) {
        const tier = await updateTier(tierModal.data.id, payload)
        setProducts(prev => prev.map(p => p.id === tierModal.productId ? { ...p, tiers: (p.tiers ?? []).map(t => t.id === tierModal.data!.id ? tier as any : t) } : p))
        toast({ title: "✅ Plan Updated", description: "Pricing plan updated and revalidated." })
      }
      setTierModal(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleGatewaySync = async () => {
    if (!tName || !tPrice) {
      toast({ title: "Error", description: "Name and Price are required to sync with gateway", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/admin/tiers/sync-gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tName,
          description: tDesc,
          price: Number(tPrice),
          currency: tCurrency,
          interval: tInterval,
          productId: tierModal?.productId
        })
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || "Failed to sync with gateway")
      }
      const data = await res.json()
      if (data.stripePriceId) setTStripePriceId(data.stripePriceId)
      if (data.stripeProductId) setTStripeProductId(data.stripeProductId)
      if (data.razorpayPlanId) setTRazorpayPlanId(data.razorpayPlanId)
      toast({ title: "✅ Gateway Sync Success", description: "Successfully created plan in Payment Gateways." })
    } catch (e: any) {
      toast({ title: "Sync Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleRepublish = async (productId: string) => {
    startTransition(async () => {
      try {
        const updated = await republishProduct(productId)
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, status: updated.status, assignedUserId: null, assignedEmail: null, reservedUntil: null } : p))
        toast({ title: "Republished successfully", description: "Product is now available on the marketplace." })
      } catch (err: any) {
        toast({ title: "Republish Failed", description: err.message, variant: "destructive" })
      }
    })
  }

  const handleStatusChange = async (productId: string, status: ProductStatus) => {
    try {
      await updateProductStatus(productId, status)
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, status } : p))
      toast({ title: `Status → ${STATUS_CONFIG[status].label}`, description: "Website updated automatically." })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleBadgeToggle = async (productId: string, badge: "isFeatured" | "isPinned" | "isTrending" | "isBestSeller", current: boolean) => {
    try {
      await toggleProductBadge(productId, badge, !current)
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, [badge]: !current } : p))
      toast({ title: `Badge ${!current ? "Enabled" : "Disabled"}`, description: `${badge.replace("is", "")} updated.` })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleDeleteProduct = async () => {
    if (!deleteConfirm) return
    setLoading(true)
    try {
      await deleteProduct(deleteConfirm.productId)
      setProducts(prev => prev.filter(p => p.id !== deleteConfirm.productId))
      setDeleteConfirm(null)
      toast({ title: "Product Deleted", description: `"${deleteConfirm.name}" has been deleted.` })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async (product: Product) => {
    try {
      const dup = await duplicateProduct(product.id)
      setProducts(prev => [normalizeProduct(dup as any), ...prev])
      toast({ title: "✅ Duplicated", description: `"${product.name}" duplicated as draft.` })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleRestoreVersion = async (productId: string, versionId: string) => {
    try {
      await restoreProductVersion(productId, versionId)
      toast({ title: "✅ Version Restored", description: "Product restored to selected version." })
      setHistoryModal(null)
      window.location.reload()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  // ─── Product Card ──────────────────────────────────────────────────────────────

  const renderProductCard = (product: Product) => {
    const expanded = expandedProducts.has(product.id)
    const sc = STATUS_CONFIG[product.status]
    const tiers = product.tiers ?? []

    return (
      <div key={product.id} className="group border border-border/60 rounded-2xl bg-card shadow-sm hover:shadow-md transition-all overflow-hidden">
        {/* Product Header */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Thumbnail */}
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-border/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {product.thumbnailUrl ? (
              <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="h-6 w-6 text-violet-400" />
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-foreground truncate">{product.name}</h2>
              {/* Status Badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.color}`}>
                {sc.icon} {sc.label}
              </span>
              {/* Product Type */}
              <span className="text-[10px] border border-border/60 text-muted-foreground px-2 py-0.5 rounded-full">
                {PRODUCT_TYPES.find(t => t.value === product.type)?.icon} {PRODUCT_TYPES.find(t => t.value === product.type)?.label}
              </span>
              {/* Badges */}
              {product.isFeatured && <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5"><Star className="h-2.5 w-2.5" />Featured</span>}
              {product.isTrending && <span className="text-[9px] bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5"><TrendingUp className="h-2.5 w-2.5" />Trending</span>}
              {product.isBestSeller && <span className="text-[9px] bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5"><Award className="h-2.5 w-2.5" />Bestseller</span>}
              {product.isPinned && <span className="text-[9px] bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5"><Pin className="h-2.5 w-2.5" />Pinned</span>}
              {product.isPremium && <span className="text-[9px] bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5"><Crown className="h-2.5 w-2.5" />Premium</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{product.tagline}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="font-mono">/{product.slug}</span>
              {product.category && <span>• {product.category}</span>}
              <span>• v{product.version}</span>
              <span>• {tiers.length} plan{tiers.length !== 1 ? "s" : ""}</span>
              {product.assignedUserId && (
                <div className="w-full text-xs mt-2 p-2 bg-muted rounded-lg flex flex-col gap-1 max-w-sm">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Customer:</span>
                    <span className="font-medium text-foreground">{product.assignedEmail ?? "Unknown User"}</span>
                  </div>
                  {product.reservedUntil && (
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Reserved Until:</span>
                      <span className="font-medium text-foreground">{new Date(product.reservedUntil).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Quick Status Change */}
            <select
              className="text-xs border border-border/60 rounded-lg px-2 py-1.5 bg-background text-foreground"
              value={product.status}
              onChange={(e) => handleStatusChange(product.id, e.target.value as ProductStatus)}
            >
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                <option key={val} value={val}>{cfg.label}</option>
              ))}
            </select>

            {product.status === "REPUBLISH_PENDING" && (
              <Button size="sm" variant="secondary" className="bg-purple-100 text-purple-900 hover:bg-purple-200" onClick={() => handleRepublish(product.id)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Republish
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={() => openProductModal("edit", product)}>
              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
            <Button size="sm" onClick={() => openTierModal("create", product.id)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Plan
            </Button>

            {/* More Actions Dropdown */}
            <div className="relative group/menu">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
              <div className="absolute right-0 top-full mt-1 w-44 bg-popover border border-border rounded-xl shadow-xl z-20 py-1 opacity-0 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:pointer-events-auto transition-all">
                <button onClick={() => setHistoryModal({ product })} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"><History className="h-3.5 w-3.5" />Version History</button>
                <button onClick={() => handleDuplicate(product)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"><Copy className="h-3.5 w-3.5" />Duplicate</button>
                <button onClick={() => handleBadgeToggle(product.id, "isFeatured", product.isFeatured)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"><Star className="h-3.5 w-3.5" />{product.isFeatured ? "Unfeature" : "Feature"}</button>
                <button onClick={() => handleBadgeToggle(product.id, "isTrending", product.isTrending)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" />{product.isTrending ? "Remove Trending" : "Mark Trending"}</button>
                <button onClick={() => handleBadgeToggle(product.id, "isBestSeller", product.isBestSeller)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"><Award className="h-3.5 w-3.5" />{product.isBestSeller ? "Remove Bestseller" : "Mark Bestseller"}</button>
                <button onClick={() => handleBadgeToggle(product.id, "isPinned", product.isPinned)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"><Pin className="h-3.5 w-3.5" />{product.isPinned ? "Unpin" : "Pin to Homepage"}</button>
                <div className="border-t border-border/60 my-1" />
                <button onClick={() => setDeleteConfirm({ productId: product.id, name: product.name })} className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" />Delete Product</button>
              </div>
            </div>

            <button onClick={() => toggleExpand(product.id)} className="text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Tiers Table */}
        {expanded && (
          <div className="border-t border-border/60">
            {tiers.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <DollarSign className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No pricing plans configured yet.</p>
                <Button size="sm" className="mt-3" onClick={() => openTierModal("create", product.id)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create First Plan
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/60">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Plan</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pricing</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Trial</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Limits</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">AI Config</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Regional</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {[...tiers].sort((a, b) => a.sortOrder - b.sortOrder).map(tier => (
                      <tr key={tier.id} className="hover:bg-muted/20 transition-colors group/row">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-sm">{tier.name}</span>
                                {tier.isPopular && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase font-bold">Popular</span>}
                                {tier.isRecommended && <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded uppercase font-bold">Recommended</span>}
                              </div>
                              {tier.description && <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[160px] truncate">{tier.description}</p>}
                              <p className="text-[10px] text-muted-foreground mt-0.5">{BILLING_INTERVALS.find(i => i.value === tier.interval)?.label}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm font-semibold">
                            {tier.discountPrice ? (
                              <div>
                                <span className="line-through text-muted-foreground text-xs">${tier.price}</span>
                                <span className="text-emerald-600 ml-1">${tier.discountPrice}</span>
                              </div>
                            ) : (
                              <span>${tier.price}</span>
                            )}
                          </div>
                          {tier.flashSalePrice && (
                            <div className="text-[10px] text-red-600 mt-0.5 flex items-center gap-0.5">
                              <FlameKindling className="h-2.5 w-2.5" />
                              Flash: ${tier.flashSalePrice}
                            </div>
                          )}
                          {tier.introPrice && <p className="text-[10px] text-blue-600 mt-0.5">Intro: ${tier.introPrice} / {tier.introPeriodDays}d</p>}
                          {tier.setupFee && <p className="text-[10px] text-muted-foreground mt-0.5">Setup: ${tier.setupFee}</p>}
                          {tier.taxRate > 0 && <p className="text-[10px] text-muted-foreground">Tax: {tier.taxRate}%{tier.taxInclusive ? " incl." : " excl."}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {tier.trialDays > 0 ? <span className="text-emerald-600 font-medium">{tier.trialDays}d free</span> : <span>—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs space-y-0.5">
                          {tier.limits?.apiQuota && <p className="flex items-center gap-1"><Code2 className="h-2.5 w-2.5 text-blue-500" />{tier.limits.apiQuota} API calls</p>}
                          {tier.limits?.tokenLimit && <p className="flex items-center gap-1"><Cpu className="h-2.5 w-2.5 text-violet-500" />{tier.limits.tokenLimit.toLocaleString()} tokens</p>}
                          {tier.limits?.seatLimit && <p className="flex items-center gap-1"><Users className="h-2.5 w-2.5 text-blue-500" />{tier.limits.seatLimit} seats</p>}
                          {tier.limits?.storageGB && <p className="flex items-center gap-1"><Database className="h-2.5 w-2.5 text-orange-500" />{tier.limits.storageGB}GB storage</p>}
                          {!tier.limits?.apiQuota && !tier.limits?.tokenLimit && !tier.limits?.seatLimit && !tier.limits?.storageGB && <span className="text-muted-foreground text-[10px]">Unlimited</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {tier.limits?.aiConfig ? (
                            <div className="flex items-start gap-1">
                              <Sparkles className="h-3 w-3 text-violet-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-violet-600 text-[10px]">{tier.limits.aiConfig.model}</p>
                                <p className="text-[9px] text-muted-foreground">{tier.limits.aiConfig.tokenMultiplier}x mult.</p>
                              </div>
                            </div>
                          ) : <span className="text-muted-foreground text-[10px]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono space-y-0.5">
                          {tier.limits?.regionalPricing?.INR && <p>₹{tier.limits.regionalPricing.INR}</p>}
                          {tier.limits?.regionalPricing?.EUR && <p>€{tier.limits.regionalPricing.EUR}</p>}
                          {tier.limits?.regionalPricing?.GBP && <p>£{tier.limits.regionalPricing.GBP}</p>}
                          {!tier.limits?.regionalPricing && <span className="text-muted-foreground text-[10px]">Base</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tier.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                            {tier.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => openTierModal("edit", product.id, tier)}>
                            Configure
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product & Plan Management</h1>
          <p className="text-sm text-muted-foreground">Enterprise commerce CMS — create, publish, price, and sync products instantly to your website.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync
          </Button>
          <Button onClick={() => openProductModal("create")} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> New Product
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or slug..."
            className="pl-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="border border-input rounded-lg px-3 py-2 text-sm bg-background"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="ALL">All Types</option>
          {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
        </select>
        <select
          className="border border-input rounded-lg px-3 py-2 text-sm bg-background"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
        </select>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Products", val: products.length, color: "text-violet-600" },
          { label: "Published", val: products.filter(p => p.status === "AVAILABLE").length, color: "text-emerald-600" },
          { label: "Draft", val: products.filter(p => p.status === "DRAFT").length, color: "text-amber-600" },
          { label: "Featured", val: products.filter(p => p.isFeatured).length, color: "text-amber-500" },
        ].map(stat => (
          <div key={stat.label} className="border border-border/60 rounded-xl p-3 bg-card">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.val}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Product List */}
      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="border-2 border-dashed border-border/60 rounded-2xl py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No products found. Create your first product.</p>
            <Button className="mt-4" onClick={() => openProductModal("create")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create Product
            </Button>
          </div>
        ) : (
          filteredProducts.map(renderProductCard)
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* PRODUCT FORM MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {productModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{productModal === "create" ? "Create New Product" : `Edit: ${activeProduct?.name}`}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">All changes instantly sync to the website via ISR revalidation.</p>
              </div>
              <button onClick={() => setProductModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6 gap-1">
              {(["basic", "media", "features", "seo", "pricing"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-xs font-medium capitalize border-b-2 -mb-px transition-colors ${activeTab === tab ? "border-violet-500 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {tab === "basic" && "📋 Basic Info"}
                  {tab === "media" && "🖼️ Media"}
                  {tab === "features" && "⚙️ Features"}
                  {tab === "seo" && "🔍 SEO"}
                  {tab === "pricing" && "💳 Pricing & Plans"}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">

              {/* ─── Basic Info ─── */}
              {activeTab === "basic" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Product Name *</label>
                      <Input value={pName} onChange={e => { setPName(e.target.value); if (!activeProduct) setPSlug(generateSlug(e.target.value)) }} placeholder="e.g. AI Content Writer Pro" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Slug (URL Identifier)</label>
                      <Input value={pSlug} onChange={e => setPSlug(e.target.value)} placeholder="e.g. ai-content-writer-pro" className="mt-1 font-mono text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Tagline / Short Description</label>
                    <Input value={pTagline} onChange={e => setPTagline(e.target.value)} placeholder="e.g. Create stunning copy in seconds with AI" className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
                    <Textarea value={pDesc} onChange={e => setPDesc(e.target.value)} placeholder="Detailed product description..." rows={3} className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Long Description (Rich Content)</label>
                    <Textarea value={pLongDesc} onChange={e => setPLongDesc(e.target.value)} placeholder="Detailed rich-text content for the product page..." rows={5} className="mt-1 font-mono text-sm" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Product Type</label>
                      <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={pType} onChange={e => setPType(e.target.value as ProductType)}>
                        {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Status</label>
                      <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={pStatus} onChange={e => setPStatus(e.target.value as ProductStatus)}>
                        {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Category</label>
                      <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={pCategory} onChange={e => setPCategory(e.target.value)}>
                        <option value="">Select Category</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Subcategory</label>
                      <Input value={pSubcategory} onChange={e => setPSubcategory(e.target.value)} placeholder="e.g. Copywriting" className="mt-1" />
                    </div>
                  </div>

                  {pStatus === "SCHEDULED" && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Scheduled Publish Date</label>
                      <Input type="datetime-local" value={pScheduledAt} onChange={e => setPScheduledAt(e.target.value)} className="mt-1" />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Tags (comma-separated)</label>
                      <Input value={pTags} onChange={e => setPTags(e.target.value)} placeholder="e.g. AI, content, writing, productivity" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Badge Text (Optional)</label>
                      <Input value={pBadgeText} onChange={e => setPBadgeText(e.target.value)} placeholder="e.g. NEW, HOT, LIMITED" className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input type="checkbox" checked={pIsPremium} onChange={e => setPIsPremium(e.target.checked)} className="w-4 h-4 rounded" />
                      Premium Product
                    </label>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Pro Points Reward</label>
                      <Input type="number" value={pPoints} onChange={e => setPPoints(Number(e.target.value))} className="mt-1" />
                    </div>
                  </div>

                  {productModal === "edit" && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Version Note (for history)</label>
                      <Input value={pVersionNote} onChange={e => setPVersionNote(e.target.value)} placeholder="e.g. Updated pricing section and description" className="mt-1" />
                    </div>
                  )}
                </div>
              )}

              {/* ─── Media ─── */}
              {activeTab === "media" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">Paste direct URLs to media files. Use Cloudinary, AWS S3, or any CDN for optimal performance.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><Image className="h-3.5 w-3.5" />Thumbnail URL</label>
                      <Input value={pThumbnail} onChange={e => setPThumbnail(e.target.value)} placeholder="https://cdn.example.com/product-thumb.jpg" className="mt-1 font-mono text-xs" />
                      {pThumbnail && <img src={pThumbnail} alt="Thumbnail preview" className="mt-2 w-20 h-20 object-cover rounded-lg border border-border" />}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><Image className="h-3.5 w-3.5" />Product Icon URL</label>
                      <Input value={pIcon} onChange={e => setPIcon(e.target.value)} placeholder="https://cdn.example.com/product-icon.svg" className="mt-1 font-mono text-xs" />
                      {pIcon && <img src={pIcon} alt="Icon preview" className="mt-2 w-10 h-10 object-cover rounded border border-border" />}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><Image className="h-3.5 w-3.5" />Banner Image URL</label>
                    <Input value={pBanner} onChange={e => setPBanner(e.target.value)} placeholder="https://cdn.example.com/product-banner.jpg" className="mt-1 font-mono text-xs" />
                    {pBanner && <img src={pBanner} alt="Banner preview" className="mt-2 w-full h-24 object-cover rounded-xl border border-border" />}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><Image className="h-3.5 w-3.5" />Screenshot URLs (comma-separated)</label>
                    <Textarea value={pScreenshots} onChange={e => setPScreenshots(e.target.value)} placeholder="https://cdn.example.com/ss1.jpg, https://cdn.example.com/ss2.jpg" rows={2} className="mt-1 font-mono text-xs" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><Video className="h-3.5 w-3.5" />Video URLs (comma-separated)</label>
                    <Input value={pVideos} onChange={e => setPVideos(e.target.value)} placeholder="https://youtube.com/embed/... or .mp4 URL" className="mt-1 font-mono text-xs" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><ExternalLink className="h-3.5 w-3.5" />Demo URL</label>
                      <Input value={pDemoUrl} onChange={e => setPDemoUrl(e.target.value)} placeholder="https://demo.yourproduct.com" className="mt-1 font-mono text-xs" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Documentation URL</label>
                      <Input value={pDocUrl} onChange={e => setPDocUrl(e.target.value)} placeholder="https://docs.yourproduct.com" className="mt-1 font-mono text-xs" />
                    </div>
                  </div>

                  {/* Preview Configuration */}
                  <div className="border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5" />Live Preview
                      </label>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={pPreviewEnabled}
                        onClick={() => setPPreviewEnabled(!pPreviewEnabled)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pPreviewEnabled ? "bg-purple-500" : "bg-zinc-700"}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${pPreviewEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    {pPreviewEnabled && (
                      <div className="space-y-3 pl-1">
                        <div>
                          <label className="block text-[10px] text-zinc-500 mb-1">Preview App URL *</label>
                          <Input
                            placeholder="https://preview.your-app.com"
                            value={pPreviewConfig?.url ?? ""}
                            onChange={e => setPPreviewConfig({ ...(pPreviewConfig || {}), url: e.target.value })}
                            className="text-xs font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-1">Session Timeout (min)</label>
                            <Input
                              type="number"
                              min={1}
                              max={60}
                              value={pPreviewConfig?.sessionTimeoutMinutes ?? 5}
                              onChange={e => setPPreviewConfig({ ...(pPreviewConfig || {}), sessionTimeoutMinutes: Number(e.target.value) })}
                              className="text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-1">Max Previews/User</label>
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              value={pPreviewConfig?.maxPreviewsPerUser ?? 5}
                              onChange={e => setPPreviewConfig({ ...(pPreviewConfig || {}), maxPreviewsPerUser: Number(e.target.value) })}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Features (Badges) ─── */}
              {activeTab === "features" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Configure product visibility badges and status on the website.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "isFeatured" as const, label: "Featured Product", desc: "Highlighted in featured sections", icon: <Star className="h-4 w-4 text-amber-500" /> },
                      { key: "isPinned" as const, label: "Pinned to Homepage", desc: "Always shown at the top", icon: <Pin className="h-4 w-4 text-purple-500" /> },
                      { key: "isTrending" as const, label: "Trending Badge", desc: "Shown in trending sections", icon: <TrendingUp className="h-4 w-4 text-blue-500" /> },
                      { key: "isBestSeller" as const, label: "Bestseller Badge", desc: "Shown with bestseller ribbon", icon: <Award className="h-4 w-4 text-orange-500" /> },
                    ].map(item => {
                      const currentVal = activeProduct ? (activeProduct as any)[item.key] : false
                      return (
                        <div key={item.key} className="border border-border/60 rounded-xl p-3 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">{item.icon}</div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                            <p className="text-xs text-muted-foreground mt-1">Current: <span className={currentVal ? "text-emerald-600 font-medium" : "text-zinc-500"}>{currentVal ? "Active" : "Inactive"}</span></p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground italic">💡 Tip: Use the "..." menu on product cards to toggle badges quickly without opening this modal.</p>
                </div>
              )}

              {/* ─── SEO ─── */}
              {activeTab === "seo" && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3 flex items-start gap-2">
                    <Globe className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">SEO metadata is automatically injected into product pages via Next.js metadata API. Changes take effect instantly on publish.</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">SEO Meta Title</label>
                    <Input value={pSeoTitle} onChange={e => setPSeoTitle(e.target.value)} placeholder="e.g. AI Content Writer Pro — Best AI Writing Tool" className="mt-1" />
                    <p className="text-[10px] text-muted-foreground mt-1">{pSeoTitle.length}/60 chars recommended</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">SEO Meta Description</label>
                    <Textarea value={pSeoDesc} onChange={e => setPSeoDesc(e.target.value)} placeholder="Concise description for search engines..." rows={3} className="mt-1" />
                    <p className="text-[10px] text-muted-foreground mt-1">{pSeoDesc.length}/160 chars recommended</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">SEO Keywords (comma-separated)</label>
                    <Input value={pSeoKeywords} onChange={e => setPSeoKeywords(e.target.value)} placeholder="e.g. ai writing, content generator, copywriting tool" className="mt-1" />
                  </div>

                  {/* Preview */}
                  {(pSeoTitle || pSeoDesc) && (
                    <div className="border border-border/60 rounded-xl p-4 bg-muted/20">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Google Preview</p>
                      <p className="text-blue-600 text-sm font-medium">{pSeoTitle || pName}</p>
                      <p className="text-xs text-green-700 dark:text-green-500">yoursite.com/products/{pSlug}</p>
                      <p className="text-xs text-muted-foreground mt-1">{pSeoDesc || pDesc}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Pricing & Plans ─── */}
              {activeTab === "pricing" && (
                <div className="space-y-4">
                  {productModal === "create" ? (
                    <div className="border-2 border-dashed border-border/60 rounded-2xl py-12 text-center bg-muted/10">
                      <CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm font-medium">Save basic product info first</p>
                      <p className="text-xs text-muted-foreground mt-1">You can configure pricing plans and gateway settings after the product is created.</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-sm">Pricing Plans</h3>
                          <p className="text-xs text-muted-foreground">Manage subscription tiers, one-time payments, and usage limits.</p>
                        </div>
                        <Button size="sm" onClick={() => openTierModal("create", activeProduct!.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8">
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Plan
                        </Button>
                      </div>
                      
                      {(activeProduct?.tiers || []).length === 0 ? (
                        <div className="border border-border/60 rounded-xl py-8 text-center bg-muted/10">
                          <p className="text-sm text-muted-foreground">No pricing plans configured yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(activeProduct?.tiers || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(tier => (
                            <div key={tier.id} className="border border-border rounded-xl p-3 flex items-center justify-between bg-card hover:border-border/80 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tier.isActive ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900/30'}`}>
                                  {tier.interval === "MONTHLY" ? <Calendar className="h-4 w-4" /> : tier.interval === "YEARLY" ? <CalendarDays className="h-4 w-4" /> : tier.interval === "LIFETIME" ? <Infinity className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-sm">{tier.name}</p>
                                    {!tier.isActive && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm bg-zinc-100 text-zinc-500 dark:bg-zinc-800">Draft</span>}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {tier.currency} {tier.discountPrice ? <><span className="line-through opacity-60">{tier.price}</span> <span>{tier.discountPrice}</span></> : tier.price} / {tier.interval.toLowerCase()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => openTierModal("edit", activeProduct!.id, tier as any)}>
                                  Configure
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                {productModal === "edit" ? "💾 Saves version snapshot automatically." : "✅ Product will be created in selected status."}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setProductModal(null)}>Cancel</Button>
                <Button onClick={saveProduct} disabled={loading || !pName || !pSlug} className="bg-violet-600 hover:bg-violet-700 text-white">
                  {loading ? "Saving..." : productModal === "create" ? "Create Product" : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* TIER / PLAN FORM MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {tierModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{tierModal.mode === "create" ? "Add Pricing Plan" : `Configure: ${tierModal.data?.name}`}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Pricing plans automatically sync with subscriptions, checkout, invoices, and AI quotas.</p>
              </div>
              <button onClick={() => setTierModal(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ─── Left: Core Pricing ─── */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-violet-600 border-b border-border pb-2">Core Pricing</h3>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Plan Name *</label>
                    <Input value={tName} onChange={e => setTName(e.target.value)} placeholder="e.g. Pro Creator, Enterprise, Starter" className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Plan Description</label>
                    <Input value={tDesc} onChange={e => setTDesc(e.target.value)} placeholder="Short description of this plan" className="mt-1" />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Base Price</label>
                      <Input type="number" value={tPrice} onChange={e => setTPrice(e.target.value)} placeholder="29.00" className="mt-1 font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Sale Price</label>
                      <Input type="number" value={tDiscountPrice} onChange={e => setTDiscountPrice(e.target.value)} placeholder="19.00" className="mt-1 font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Currency</label>
                      <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={tCurrency} onChange={e => setTCurrency(e.target.value)}>
                        {["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Billing Interval</label>
                    <select className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background" value={tInterval} onChange={e => setTInterval(e.target.value as BillingInterval)}>
                      {BILLING_INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Trial Days</label>
                      <Input type="number" value={tTrialDays} onChange={e => setTTrialDays(e.target.value)} placeholder="0" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Tax Rate %</label>
                      <Input type="number" value={tTaxRate} onChange={e => setTTaxRate(e.target.value)} placeholder="0" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Setup Fee</label>
                      <Input type="number" value={tSetupFee} onChange={e => setTSetupFee(e.target.value)} placeholder="0" className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Intro Price</label>
                      <Input type="number" value={tIntroPrice} onChange={e => setTIntroPrice(e.target.value)} placeholder="First X days price" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Intro Period (days)</label>
                      <Input type="number" value={tIntroDays} onChange={e => setTIntroDays(e.target.value)} placeholder="30" className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <div>
                      <label className="text-xs font-semibold text-red-500 uppercase flex items-center gap-1"><FlameKindling className="h-3 w-3" />Flash Sale Price</label>
                      <Input type="number" value={tFlashPrice} onChange={e => setTFlashPrice(e.target.value)} placeholder="Flash deal price" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Flash Sale Ends</label>
                      <Input type="datetime-local" value={tFlashEnds} onChange={e => setTFlashEnds(e.target.value)} className="mt-1" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={tTaxInclusive} onChange={e => setTTaxInclusive(e.target.checked)} className="w-4 h-4 rounded" />Tax Inclusive</label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={tIsPopular} onChange={e => setTIsPopular(e.target.checked)} className="w-4 h-4 rounded" />Mark as Popular</label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={tIsRecommended} onChange={e => setTIsRecommended(e.target.checked)} className="w-4 h-4 rounded" />Mark as Recommended</label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={tIsActive} onChange={e => setTIsActive(e.target.checked)} className="w-4 h-4 rounded" />Active (visible to users)</label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Plan Features (one per line)</label>
                    <Textarea value={tFeatures} onChange={e => setTFeatures(e.target.value)} placeholder={"Unlimited projects\nPriority support\n4K Export\nAPI access\nAdvanced analytics"} rows={5} className="mt-1 font-mono text-xs" />
                  </div>
                </div>

                {/* ─── Right: Quotas & Advanced ─── */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 border-b border-border pb-2">Quotas & Limits</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><Code2 className="h-3 w-3" />API Quota (calls/mo)</label>
                      <Input type="number" value={tApiQuota} onChange={e => setTApiQuota(e.target.value)} placeholder="1000" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><Cpu className="h-3 w-3" />Token Limit</label>
                      <Input type="number" value={tTokenLimit} onChange={e => setTTokenLimit(e.target.value)} placeholder="100000" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><Users className="h-3 w-3" />Seat Limit</label>
                      <Input type="number" value={tSeatLimit} onChange={e => setTSeatLimit(e.target.value)} placeholder="5" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><Database className="h-3 w-3" />Storage (GB)</label>
                      <Input type="number" value={tStorageGB} onChange={e => setTStorageGB(e.target.value)} placeholder="100" className="mt-1" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Feature Flags (comma-separated)</label>
                    <Input value={tFlags} onChange={e => setTFlags(e.target.value)} placeholder="enable_ai_chat, access_reports, export_api" className="mt-1 font-mono text-xs" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Sort Order</label>
                    <Input type="number" value={tSortOrder} onChange={e => setTSortOrder(e.target.value)} placeholder="0" className="mt-1 w-24" />
                  </div>

                  <h3 className="text-xs font-bold uppercase tracking-wider text-violet-600 border-b border-border pb-2 pt-2 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />AI Configuration</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">AI Model</label>
                      <select className="w-full mt-1 border border-input rounded-lg px-2 py-2 text-xs bg-background" value={tAiModel} onChange={e => setTAiModel(e.target.value)}>
                        <option value="">No AI Features</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="claude-3-opus">Claude 3 Opus</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="llama-3.1-70b">Llama 3.1 70B</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Token Multiplier</label>
                      <Input type="number" step="0.1" value={tAiMult} onChange={e => setTAiMult(e.target.value)} className="mt-1" />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b border-border pb-2 pt-2 flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Regional Pricing Overrides</h3>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">INR (₹)</label>
                      <Input type="number" value={tRegINR} onChange={e => setTRegINR(e.target.value)} placeholder="499" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">EUR (€)</label>
                      <Input type="number" value={tRegEUR} onChange={e => setTRegEUR(e.target.value)} placeholder="9.99" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">GBP (£)</label>
                      <Input type="number" value={tRegGBP} onChange={e => setTRegGBP(e.target.value)} placeholder="8.99" className="mt-1" />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 border-b border-border pb-2 pt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />Payment Gateway Configuration</span>
                    <Button variant="outline" size="sm" onClick={handleGatewaySync} disabled={loading || !tName || !tPrice} className="h-6 text-[10px] px-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200">
                      Create in Gateway API
                    </Button>
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">Stripe Price ID</label>
                      <Input value={tStripePriceId} onChange={e => setTStripePriceId(e.target.value)} placeholder="price_1NXXXX..." className="mt-1 font-mono text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">Razorpay Plan ID</label>
                      <Input value={tRazorpayPlanId} onChange={e => setTRazorpayPlanId(e.target.value)} placeholder="plan_NXXXXX..." className="mt-1 font-mono text-xs" />
                    </div>
                  </div>

                  {tierModal.mode === "edit" && (
                    <div className="pt-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Price Change Reason (for audit log)</label>
                      <Input value={tPriceNote} onChange={e => setTPriceNote(e.target.value)} placeholder="e.g. Annual pricing adjustment Q1 2025" className="mt-1" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Plan changes propagate to subscriptions, checkout, and invoices automatically.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setTierModal(null)}>Cancel</Button>
                <Button onClick={saveTier} disabled={loading || !tName || !tPrice} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {loading ? "Saving..." : tierModal.mode === "create" ? "Create Plan" : "Save Plan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* VERSION HISTORY MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><History className="h-5 w-5" />Version History</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{historyModal.product.name}</p>
              </div>
              <button onClick={() => setHistoryModal(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              {(historyModal.product.versions || []).length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No version history yet. History is saved on each edit.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(historyModal.product.versions || []).sort((a, b) => b.version - a.version).map(v => (
                    <div key={v.id} className="border border-border/60 rounded-xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xs font-bold text-violet-600 flex-shrink-0">
                        v{v.version}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{v.changeNote || "Version snapshot"}</p>
                          <span className="text-[10px] text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">by {v.changedByName || "Admin"}</p>
                      </div>
                      <Button variant="outline" size="sm" className="text-xs flex-shrink-0" onClick={() => handleRestoreVersion(historyModal.product.id, v.id)}>
                        <RotateCcw className="h-3 w-3 mr-1" />Restore
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* DELETE CONFIRM MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold">Delete Product</h3>
                <p className="text-sm text-muted-foreground mt-1">This will permanently delete <strong>"{deleteConfirm.name}"</strong> and all its pricing plans. Active subscriptions using this product will be affected. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteProduct} disabled={loading}>
                {loading ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
