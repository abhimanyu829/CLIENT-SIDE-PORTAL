import Link from "next/link"

export const metadata = {
  title: "Unauthorized — NexusAI",
}

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .text-gradient { background: linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .btn-gradient { background: linear-gradient(135deg,#6366f1,#8b5cf6); }
      `}</style>
      <div className="glass rounded-2xl p-10 max-w-md w-full mx-4 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center text-4xl">
          🔒
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">Access Denied</h1>
          <p className="text-zinc-400">
            You don&apos;t have permission to access the admin panel. This area is restricted to administrators only.
          </p>
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/dashboard"
            className="btn-gradient px-6 py-3 rounded-xl font-bold text-white hover:scale-105 transition-all"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="glass px-6 py-3 rounded-xl font-bold text-zinc-300 hover:border-white/20 transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
