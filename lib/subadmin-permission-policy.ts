export const SUBADMIN_RESOURCES = [
  "Products",
  "Services",
  "Users",
  "Orders",
  "Payments",
  "Refunds",
  "Analytics",
  "Email Center",
  "Support",
  "Media",
  "Blogs",
  "Marketing",
  "CRM",
  "Documentation",
] as const

export const SUBADMIN_ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "PUBLISH"] as const

export type SubadminResource = (typeof SUBADMIN_RESOURCES)[number]
export type SubadminAction = (typeof SUBADMIN_ACTIONS)[number]

export function isSubadminResource(value: string): value is SubadminResource {
  return (SUBADMIN_RESOURCES as readonly string[]).includes(value)
}

export function isSubadminAction(value: string): value is SubadminAction {
  return (SUBADMIN_ACTIONS as readonly string[]).includes(value)
}

export type SubadminPermission = {
  resource: SubadminResource
  action: SubadminAction
}

type RoutePolicy = {
  prefix: string
  resource: SubadminResource
}

const ADMIN_LANDING_ROUTES: Array<{ path: string; resource: SubadminResource }> = [
  { path: "/admin/deployment-center", resource: "Services" },
  { path: "/admin", resource: "Analytics" },
  { path: "/admin/ecosystem", resource: "Marketing" },
  { path: "/admin/users", resource: "Users" },
  { path: "/admin/subscriptions", resource: "Orders" },
  { path: "/admin/orders", resource: "Orders" },
  { path: "/admin/payments", resource: "Payments" },
  { path: "/admin/products", resource: "Products" },
  { path: "/admin/products/service-management", resource: "Products" },
  { path: "/admin/services", resource: "Services" },
  { path: "/admin/service-requests", resource: "Services" },
  { path: "/admin/service-campaigns", resource: "Marketing" },
  { path: "/admin/previews", resource: "Media" },
  { path: "/admin/credential-requests", resource: "Users" },
  { path: "/admin/coupons", resource: "Marketing" },
  { path: "/admin/emails", resource: "Email Center" },
  { path: "/admin/analytics", resource: "Analytics" },
  { path: "/admin/ai-monitoring", resource: "Analytics" },
]

// Keep the workforce permission vocabulary independent from the marketplace domain.
// Each entry covers both the page route and its matching /api/admin route.
const ROUTE_POLICIES: RoutePolicy[] = [
  { prefix: "/admin/deployment-center", resource: "Services" },
  { prefix: "/admin/users", resource: "Users" },
  { prefix: "/admin/credential-requests", resource: "Users" },
  { prefix: "/admin/subscriptions", resource: "Orders" },
  { prefix: "/admin/orders", resource: "Orders" },
  { prefix: "/admin/payments", resource: "Payments" },
  { prefix: "/admin/products", resource: "Products" },
  { prefix: "/admin/services", resource: "Services" },
  { prefix: "/admin/service-requests", resource: "Services" },
  { prefix: "/admin/service-campaigns", resource: "Marketing" },
  { prefix: "/admin/previews", resource: "Media" },
  { prefix: "/admin/coupons", resource: "Marketing" },
  { prefix: "/admin/analytics", resource: "Analytics" },
  { prefix: "/admin/revenue", resource: "Analytics" },
  { prefix: "/admin/ai-monitoring", resource: "Analytics" },
  { prefix: "/admin/emails", resource: "Email Center" },
  { prefix: "/admin/crm", resource: "CRM" },
  { prefix: "/admin/ecosystem", resource: "Marketing" },
]

const API_RESOURCE_PREFIXES: Array<{ prefix: string; resource: SubadminResource }> = [
  { prefix: "/api/admin/deployment-center", resource: "Services" },
  { prefix: "/api/admin/users", resource: "Users" },
  { prefix: "/api/admin/credential-requests", resource: "Users" },
  { prefix: "/api/admin/subscriptions", resource: "Orders" },
  { prefix: "/api/admin/orders", resource: "Orders" },
  { prefix: "/api/admin/payments", resource: "Payments" },
  { prefix: "/api/admin/refunds", resource: "Refunds" },
  { prefix: "/api/admin/products", resource: "Products" },
  { prefix: "/api/admin/services", resource: "Services" },
  { prefix: "/api/admin/service-categories", resource: "Services" },
  { prefix: "/api/admin/service-discovery", resource: "Services" },
  { prefix: "/api/admin/custom-service-portal", resource: "Services" },
  { prefix: "/api/admin/service-campaigns", resource: "Marketing" },
  { prefix: "/api/admin/campaigns", resource: "Marketing" },
  { prefix: "/api/admin/coupons", resource: "Marketing" },
  { prefix: "/api/admin/previews", resource: "Media" },
  { prefix: "/api/admin/analytics", resource: "Analytics" },
  { prefix: "/api/admin/ai-monitoring", resource: "Analytics" },
  { prefix: "/api/admin/emails", resource: "Email Center" },
  { prefix: "/api/admin/crm", resource: "CRM" },
]

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function resourceForAdminPath(pathname: string): SubadminResource | null {
  const normalizedPath = pathname.startsWith("/api/admin/")
    ? pathname.replace("/api", "")
    : pathname
  if (normalizedPath === "/admin") return "Analytics"
  const policy = ROUTE_POLICIES.find((item) => matchesPrefix(normalizedPath, item.prefix))
  return policy?.resource ?? null
}

export function resourceForAdminApiPath(pathname: string): SubadminResource | null {
  const policy = API_RESOURCE_PREFIXES.find((item) => matchesPrefix(pathname, item.prefix))
  return policy?.resource ?? null
}

export function actionForAdminRequest(pathname: string, method: string, isServerAction = false): SubadminAction {
  if (isServerAction) return "EDIT"
  if (pathname.includes("/approve") || pathname.includes("/verify") || pathname.includes("/fulfill")) return "APPROVE"
  if (pathname.includes("/publish") || pathname.includes("/send") || pathname.includes("/deliver")) return "PUBLISH"

  switch (method.toUpperCase()) {
    case "POST":
      return "CREATE"
    case "PUT":
    case "PATCH":
      return "EDIT"
    case "DELETE":
      return "DELETE"
    default:
      return "VIEW"
  }
}

export function canUseSubadminPermission(
  permissions: Array<{ resource: string; action: string }>,
  resource: string,
  action: string
) {
  return permissions.some((permission) => permission.resource === resource && permission.action === action)
}

export function firstAdminPathForPermissions(
  permissions: Array<{ resource: string; action: string }>
) {
  return ADMIN_LANDING_ROUTES.find((route) => canUseSubadminPermission(permissions, route.resource, "VIEW"))?.path ?? null
}
