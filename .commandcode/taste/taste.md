# User Taste

## Communication & Requirements
- Provides requirements as explicit numbered workflow specs (Step 1 → Step N sequences with "EXPECTED RESULT" blocks, often pasted with ASCII separators) and expects the implementation to match the spec exactly — including that retry/resubmit-after-rejection paths must re-run the identical primary workflow, not a divergent one. Confidence: 0.85
- Spots edge-case flaws in implemented flows (e.g., deny→resubmit→approve cycles) and reports them by re-pasting the reference spec the behavior must conform to; expects investigation and repair against the spec. Confidence: 0.8

## Backend Engineering Expectations
- Expects backend mutations to be idempotent and duplicate-safe: create records only "if not already created/existing", exactly ONE downstream job per action, guards against repeated clicks/retries. Confidence: 0.8
- Expects rejection/denial paths to never permanently dead-end the user — state must revert so the user can correct and resubmit, with prior review state fully reset for a fresh cycle. Confidence: 0.75

## Project & Tooling
- Main project is a Next.js App Router + TypeScript + Prisma app on Windows (`C:\Users\Abhimanyu\Desktop\start-client`), with admin routes under `app/api/admin/...` and client pages under `app/(public)/...`; validate changes with `npx tsc --noEmit` (0 errors expected before declaring done). Confidence: 0.8
