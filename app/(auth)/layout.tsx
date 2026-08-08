import { NeuralBackground } from "@/components/effects/NeuralBackground"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="relative min-h-screen bg-background flex flex-col items-center justify-center overflow-x-hidden py-16 md:py-24 px-6 sm:px-10 md:px-16 selection:bg-amber-500/20 selection:text-amber-600">
      <NeuralBackground />

      <div className="relative z-10 w-full max-w-lg mx-auto my-auto animate-in fade-in zoom-in-95 duration-500">
        {/* Header Branding */}
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-semibold tracking-wider uppercase backdrop-blur-md mb-2 shadow-sm animate-bounce" style={{ animationDuration: '3s' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            Auth Module
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground font-sans bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 bg-clip-text text-transparent">
            ABHIBHIDEVELOPERS
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            Sign in to access your enterprise dashboard
          </p>
        </div>

        {/* Card Container with Increased Margins & Soft Shadow */}
        <div className="relative group my-4">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl opacity-20 group-hover:opacity-40 blur transition duration-500" />
          <div className="relative bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-border/80 rounded-2xl p-6 sm:p-8 md:p-10 shadow-2xl transition-all duration-300">
            {children}
          </div>
        </div>

        {/* Footer Branding with Generous Bottom Spacing */}
        <div className="mt-10 mb-6 text-center flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-xs font-mono text-muted-foreground font-semibold tracking-wide">
            ABHIBHIDEVELOPERS GROUP // SECURE ACCESS PORTAL
          </p>
        </div>
      </div>
    </main>
  )
}


