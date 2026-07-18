import { NeuralBackground } from "@/components/effects/NeuralBackground"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="relative min-h-screen bg-background flex flex-col items-center justify-center overflow-hidden">
      <NeuralBackground />
      <div className="relative z-10 w-full max-w-md px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-[32px] md:text-[40px] font-medium leading-[1.04] tracking-tight text-foreground font-sans">
            Auralis Neural
          </h1>
          <p className="mt-3 text-[16px] text-muted-foreground font-sans">
            Authentication Module
          </p>
        </div>
        <div className="liquid-glass rounded-2xl p-6 md:p-10 shadow-2xl">
          {children}
        </div>
        <div className="mt-8 text-center">
          <p className="text-[12px] font-mono text-muted-foreground font-semibold">
            SECURE ACCESS PORTAL // V.1.0
          </p>
        </div>
      </div>
    </main>
  )
}
