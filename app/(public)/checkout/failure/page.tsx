import Link from "next/link"
import { AlertTriangle, ArrowLeft, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CheckoutFailurePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6">
          <AlertTriangle className="mb-4 h-10 w-10 text-red-300" />
          <h1 className="text-3xl font-black">Payment not completed</h1>
          <p className="mt-2 text-zinc-300">
            Your payment was not processed. This could be due to a cancelled transaction,
            insufficient funds, or a network issue.
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-bold mb-3">What you can do</h2>
          <ul className="space-y-3 text-sm text-zinc-400">
            <li className="flex items-start gap-2">
              <span className="text-zinc-600 mt-0.5">1.</span>
              Check your card details or UPI app and try again.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-zinc-600 mt-0.5">2.</span>
              Use a different payment method (card, UPI, netbanking).
            </li>
            <li className="flex items-start gap-2">
              <span className="text-zinc-600 mt-0.5">3.</span>
              Contact your bank if the amount was debited but not confirmed.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-zinc-600 mt-0.5">4.</span>
              Reach out to our support team for assistance.
            </li>
          </ul>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button asChild>
            <Link href="/checkout">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Try again
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/10 bg-transparent">
            <Link href="/marketplace">
              <ShoppingBag className="mr-2 h-4 w-4" />
              Browse marketplace
            </Link>
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Need help?{" "}
          <Link href="/contact-sales" className="text-indigo-400 hover:underline">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  )
}