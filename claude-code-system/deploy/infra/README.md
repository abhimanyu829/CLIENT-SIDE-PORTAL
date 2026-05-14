# Infrastructure

## Current Setup: Railway (no Terraform needed)

### Services
| Service | Type | Config |
|---|---|---|
| Web | Railway service | `npm run start`, healthcheck `/api/health` |
| Worker | Railway service | `npm run worker` |
| PostgreSQL | Railway plugin | Enable pgvector: `CREATE EXTENSION vector` |
| Redis | Railway plugin or Upstash | Used for BullMQ + rate limiting |

### Scaling (when needed)
Railway scales vertically by changing the service plan.
Horizontal scaling (multiple web instances): Railway supports this, but requires:
- Redis session store (already using JWT — no session to share)
- Sticky sessions NOT needed (stateless API)
- Just increase replicas in Railway dashboard

## Prompt to Plan Infrastructure Upgrade
```
Our current Railway setup handles [X] req/min.
We're growing to [Y] req/min.
Current bottleneck: [web CPU | DB connections | Redis memory]

Propose a scaling plan that:
1. Uses Railway managed services as much as possible
2. Costs under $[BUDGET]/month
3. Requires zero downtime to implement
4. Doesn't require Terraform or complex infrastructure

Include: estimated cost, scaling steps in order, rollback plan.
```
