"use client"

import Link from "next/link"

interface CheckoutButtonProps {
  tierId: string
  productSlug?: string
}

export function CheckoutButton({ tierId, productSlug }: CheckoutButtonProps) {
  const href = `/checkout?tierId=${encodeURIComponent(tierId)}${productSlug ? `&product=${encodeURIComponent(productSlug)}` : ""}`
  return (
    <Link href={href} className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
      Buy Now
    </Link>
  )
}
