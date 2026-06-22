"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updateProductAccessConfig } from "@/app/(admin)/admin/products/actions"
import { Link2, LogIn, LayoutDashboard, StickyNote, Save, Users, ArrowLeft } from "lucide-react"

interface Product {
  id: string
  name: string
  slug: string
  productAccessUrl?: string | null
  productLoginUrl?: string | null
  productDashboardUrl?: string | null
  productAccessNotes?: string | null
}

export default function ProductAccessConfigClient({ product }: { product: Product }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    productAccessUrl: product.productAccessUrl ?? "",
    productLoginUrl: product.productLoginUrl ?? "",
    productDashboardUrl: product.productDashboardUrl ?? "",
    productAccessNotes: product.productAccessNotes ?? "",
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const save = async () => {
    setSaving(true)
    try {
      await updateProductAccessConfig(product.id, {
        productAccessUrl: form.productAccessUrl.trim() || null,
        productLoginUrl: form.productLoginUrl.trim() || null,
        productDashboardUrl: form.productDashboardUrl.trim() || null,
        productAccessNotes: form.productAccessNotes.trim() || null,
      })
      toast.success("Access configuration saved")
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="/admin/products" className="hover:text-foreground transition-colors">Products</a>
        <span>/</span>
        <span>{product.name}</span>
        <span>/</span>
        <span>Access Configuration</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Access Configuration</h1>
          <p className="text-muted-foreground text-sm mt-1">
            URLs shown to active owners of <strong>{product.name}</strong>. Not credentials — visible only when subscription is active.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/admin/products/${product.id}/ownerships`}>
              <Users className="w-4 h-4 mr-1.5" /> Ownerships
            </a>
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-5 border border-border/50 rounded-xl p-6 bg-card/40">
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-400" /> Product Access URL
          </label>
          <Input
            value={form.productAccessUrl}
            onChange={set("productAccessUrl")}
            placeholder="https://app.yourproduct.com"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">Primary "Open Product" button URL shown in user dashboard.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-2">
            <LogIn className="w-4 h-4 text-blue-400" /> Login URL
          </label>
          <Input
            value={form.productLoginUrl}
            onChange={set("productLoginUrl")}
            placeholder="https://app.yourproduct.com/login"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">Included in credential emails sent to users.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-purple-400" /> Dashboard URL
          </label>
          <Input
            value={form.productDashboardUrl}
            onChange={set("productDashboardUrl")}
            placeholder="https://app.yourproduct.com/dashboard"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">Optional secondary access URL (e.g., admin or analytics portal).</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-400" /> Access Notes
          </label>
          <Textarea
            value={form.productAccessNotes}
            onChange={set("productAccessNotes")}
            placeholder="E.g. 'Use your registered email to log in. Contact support if you face issues.'"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">Shown as a note in the user's product card (active only).</p>
        </div>

        <div className="pt-2 flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save Configuration"}
          </Button>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1.5">
        <p className="font-medium text-foreground/60">🔒 Security Note</p>
        <p>These URLs are non-sensitive access links — they are NOT credentials. They are shown only to users with an active entitlement for this product.</p>
        <p>Sensitive credentials (username, password, API keys) are managed separately in the <strong>Delivery Config</strong> and delivered via email or the <a href="/admin/credential-requests" className="text-indigo-400 hover:underline">Credential Requests</a> system.</p>
      </div>
    </div>
  )
}
