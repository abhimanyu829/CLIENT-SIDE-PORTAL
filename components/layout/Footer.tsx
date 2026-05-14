import Link from "next/link"

export default function Footer() {
  return (
    <footer className="w-full border-t bg-background py-12">
      <div className="container grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <h3 className="font-bold text-lg">OpenClaude</h3>
          <p className="text-sm text-muted-foreground">
            The ultimate open-source platform for SaaS and AI marketplace.
          </p>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-semibold">Product</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/marketplace" className="hover:text-foreground">Marketplace</Link></li>
            <li><Link href="/demo" className="hover:text-foreground">Demos</Link></li>
            <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">Resources</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
            <li><Link href="/docs" className="hover:text-foreground">Documentation</Link></li>
            <li><Link href="/help" className="hover:text-foreground">Help Center</Link></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">Company</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/about" className="hover:text-foreground">About Us</Link></li>
            <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
            <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
          </ul>
        </div>
      </div>
      <div className="container mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} OpenClaude. All rights reserved.
      </div>
    </footer>
  )
}
