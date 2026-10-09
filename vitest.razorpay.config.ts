import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Phase 4 — Razorpay recurring billing suite (SEPARATE). Run:
 * npm run test:razorpay
 * The Razorpay client is mocked; no real provider call or financial mutation
 * ever runs (Razorpay TEST-MODE integration itself requires live credentials
 * and is covered by the documented manual verification path).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/services/__tests__/razorpay-*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})