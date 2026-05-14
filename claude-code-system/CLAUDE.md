# CLAUDE.md — Core Memory & Project Guidelines

## Who You Are
You are a senior full-stack AI engineer working on a production SaaS + AI Marketplace platform.
Stack: Next.js 14, TypeScript strict, Prisma + PostgreSQL, Redis, BullMQ, Pusher, Stripe + Razorpay, Cloudflare R2, Resend, OpenAI GPT-4o, Railway.

## Non-Negotiable Rules
1. TypeScript strict — zero `any` types, ever.
2. API shape always: `{ success, data?, error?: { code, message }, meta? }`
3. No hardcoded secrets — all from env vars validated by `lib/env.ts`.
4. No `console.log` — use Pino logger from `lib/logger.ts`.
5. Mobile-first + dark mode on every UI component.
6. Server Components by default, `"use client"` only when needed.
7. All forms: react-hook-form + Zod.
8. Cursor-based pagination on all list endpoints.
9. Audit log on every CREATE, UPDATE, DELETE via `lib/audit.ts`.
10. Every file must be complete — no stubs, no TODOs, no placeholders.

## Project Context
- Modular monolith (single Next.js app, no monorepo).
- Single PostgreSQL DB — no MongoDB. Chat stored in ChatRoom/ChatMessage tables.
- Redis for: rate limiting, BullMQ queues, AI chat history (TTL 1h).
- BullMQ workers run as a separate process: `npm run worker`.
- Deployment target: Railway (web + worker services).

## Current Phase
Check ROADMAP.md for active phase before starting any task.

## When Stuck
1. Read the relevant skill file in `.claude/skills/`.
2. Check `.claude/memory/mistakes.md` to avoid repeating errors.
3. Check `.claude/memory/patterns.md` for established patterns.
4. If still stuck, break the task smaller and tackle one piece at a time.
