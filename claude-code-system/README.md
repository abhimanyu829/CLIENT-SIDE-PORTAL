# Claude Code System — SaaS + AI Marketplace

Production-ready AI-first project structure for building with Claude Code.

## Quick Start (5 commands)
```bash
git clone <repo> && cd claude-code-system
cp .env.example .env          # fill in all values
npm install
npx prisma db push && npx tsx prisma/seed.ts
npm run dev                   # web on :3000 | worker: npm run worker
```

## Deploy to Railway (3 steps)
```bash
railway login
railway init                  # link project
railway up                    # deploys web + worker
```

## Structure
```
.claude/        Claude memory, skills, agents, workflows, hooks
docs/           Architecture decisions, runbooks, prompts
prompts/        Organized prompt library
tools/          Scripts, pipelines, evals
src/            Application source
tests/          Unit, integration, AI evals
experiments/    Prototypes and failed ideas
deploy/         Docker, configs, infra
```

## Key Commands
| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run worker` | Start BullMQ worker process |
| `npm run db:push` | Push Prisma schema to DB |
| `npm run db:seed` | Seed database |
| `npm run test` | Run all tests |
| `npm run eval` | Run AI output evaluations |
