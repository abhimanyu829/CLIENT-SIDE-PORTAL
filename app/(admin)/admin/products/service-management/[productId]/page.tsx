import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_PRODUCT_SERVICE_PROFILE, toPrettyJson } from "@/lib/product-service-profile"
import { saveProductServiceProfile } from "../actions"
import { ArrowLeft, Save } from "lucide-react"

export const metadata = { title: "Edit Product Service Profile - NexusAI Admin" }

export default async function ProductServiceProfileEditorPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  await requireAdmin()
  const { productId } = await params

  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      category: true,
      status: true,
      serviceProfile: true,
    },
  })

  if (!product) redirect("/admin/products/service-management")

  const profile = product.serviceProfile
  const defaults = DEFAULT_PRODUCT_SERVICE_PROFILE
  const action = saveProductServiceProfile.bind(null, product.id)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link href="/admin/products/service-management">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the service information center shown to owners in the dashboard.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{product.type}</Badge>
            <Badge variant="secondary">{product.category ?? "Uncategorized"}</Badge>
            <Badge variant="secondary">{product.status}</Badge>
          </div>
        </div>
      </div>

      <form action={action} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>
              High-level text displayed at the top of the customer-facing service details section.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="headline">Headline</Label>
              <Input id="headline" name="headline" defaultValue={profile?.headline ?? defaults.headline ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea id="summary" name="summary" rows={3} defaultValue={profile?.summary ?? defaults.summary ?? ""} />
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <input
                id="isPublished"
                name="isPublished"
                type="checkbox"
                defaultChecked={profile?.isPublished ?? true}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="isPublished">Publish this section in customer dashboards</Label>
            </div>
          </CardContent>
        </Card>

        <JsonSection
          name="capacity"
          title="Plan Capacity"
          description="Array of capacity groups. Use enabled=false to hide a specific item."
          value={toPrettyJson(profile?.capacity ?? defaults.capacity)}
        />
        <JsonSection
          name="freeServices"
          title="Free Services Included"
          description="Array of included services with name, description, enabled, and sortOrder."
          value={toPrettyJson(profile?.freeServices ?? defaults.freeServices)}
        />
        <JsonSection
          name="paidAddons"
          title="Paid Add-On Services"
          description="Array of paid add-ons with name, description, price, billingType, availability, activationTime, enabled, and sortOrder."
          value={toPrettyJson(profile?.paidAddons ?? defaults.paidAddons)}
        />
        <JsonSection
          name="upgradePaths"
          title="Upgrade Opportunities"
          description="Array of upgrade paths with currentPlan, upgradeTo, benefits, ctaLabel, ctaHref, and enabled."
          value={toPrettyJson(profile?.upgradePaths ?? defaults.upgradePaths)}
        />
        <JsonSection
          name="documentation"
          title="Documentation"
          description="Array of documentation links with title, description, url, and enabled."
          value={toPrettyJson(profile?.documentation ?? defaults.documentation)}
        />
        <JsonSection
          name="tutorials"
          title="Tutorials"
          description="Array of tutorial links with title, description, url, and enabled."
          value={toPrettyJson(profile?.tutorials ?? defaults.tutorials)}
        />
        <JsonSection
          name="supportBenefits"
          title="Support Benefits"
          description="Array of support benefits with name, description, enabled, and sortOrder."
          value={toPrettyJson(profile?.supportBenefits ?? defaults.supportBenefits)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Visibility Controls</CardTitle>
            <CardDescription>
              Optional comma-separated section keys to hide from this product.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Label htmlFor="hiddenFields">Hidden fields</Label>
            <Input
              id="hiddenFields"
              name="hiddenFields"
              placeholder="paidAddons,upgradePaths"
              defaultValue={(profile?.hiddenFields ?? []).join(", ")}
            />
          </CardContent>
        </Card>

        <div className="sticky bottom-4 flex justify-end">
          <Button type="submit" className="shadow-lg">
            <Save className="mr-2 h-4 w-4" /> Save Service Profile
          </Button>
        </div>
      </form>
    </div>
  )
}

function JsonSection({
  name,
  title,
  description,
  value,
}: {
  name: string
  title: string
  description: string
  value: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          name={name}
          rows={12}
          defaultValue={value}
          className="font-mono text-xs"
          spellCheck={false}
        />
      </CardContent>
    </Card>
  )
}
