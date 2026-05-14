import { Product, ProductTier, ProductReview, User } from "@prisma/client"

// Full product with all relations
export type ProductWithTiersAndReviews = Product & {
  tiers: ProductTier[]
  reviews: (ProductReview & {
    user: Pick<User, "id" | "name" | "avatarUrl">
  })[]
  _count?: { subscribers: number; reviews: number }
}

// Marketplace listing card (subset for grid display)
// Note: Product has `type` (not `category`) and ProductTier has `interval` (not `billingPeriod`)
export type ProductCard = Pick<
  Product,
  | "id"
  | "slug"
  | "name"
  | "tagline"
  | "description"
  | "thumbnailUrl"
  | "type"
  | "status"
  | "averageRating"
  | "reviewCount"
  | "viewCount"
  | "createdAt"
> & {
  tiers: Pick<ProductTier, "id" | "name" | "price" | "currency" | "interval">[]
  _count?: { subscribers: number }
}

// Admin product row (for table views)
export type ProductAdminRow = Pick<
  Product,
  "id" | "slug" | "name" | "type" | "status" | "viewCount" | "averageRating" | "createdAt"
> & {
  _count: { subscribers: number; reviews: number }
  tiers: Pick<ProductTier, "id" | "name" | "price" | "currency">[]
}

// Single product detail (for product page)
export type ProductDetail = Product & {
  tiers: ProductTier[]
  reviews: (ProductReview & {
    user: Pick<User, "id" | "name" | "avatarUrl">
  })[]
  _count: { subscribers: number; reviews: number }
}

// Tier price display
export type TierDisplay = Pick<
  ProductTier,
  "id" | "name" | "price" | "currency" | "interval" | "features" | "isPopular"
>

// Review with author
export type ReviewWithUser = ProductReview & {
  user: Pick<User, "id" | "name" | "avatarUrl">
}
