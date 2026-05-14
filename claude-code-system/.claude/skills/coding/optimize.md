# Skill: Optimize

## When to Optimize
Only optimize when you have EVIDENCE of a problem:
- Page load > 3s (measure with Lighthouse)
- API response > 500ms (measure with logs)
- DB query > 100ms (check Prisma query logs)
- Bundle size > 200kb gzipped (check Next.js analyze)

Premature optimization is the root of all evil. Measure first.

## Database Optimization Prompt
```
This query is slow: [PASTE QUERY OR PRISMA CODE]
Execution time: [TIME]ms
Table size: ~[ROWS] rows

Analyze:
1. Is there a missing index? (Check @@index in schema.prisma)
2. Is it an N+1 query? (Check for loops with DB calls inside)
3. Can we use select instead of findMany to reduce payload?
4. Can we add a composite index for this filter pattern?
5. Should this be cached in Redis? (TTL: how fresh does this data need to be?)

Propose the fix and estimate the improvement.
```

## API Response Optimization Prompt
```
This endpoint is slow: [ENDPOINT]
Profiling shows bottleneck at: [LOCATION]

Options to consider:
1. Move heavy work to a BullMQ background job
2. Cache the result in Redis with appropriate TTL
3. Use streaming response instead of waiting for full result
4. Add DB index for the slow query inside it
5. Reduce payload size with field selection

Choose the best option and implement it. Do not optimize everything at once.
```

## Frontend Bundle Optimization
```
Bundle analyzer shows [PACKAGE] is [SIZE].
Options:
1. Dynamic import: `const X = dynamic(() => import('...'))` — for components not needed on first paint
2. Replace heavy library with lighter alternative
3. Tree-shake by importing only what's needed: `import { X } from 'lib'` not `import lib from 'lib'`
```

## Caching Strategy
| Data Type | Cache? | TTL |
|---|---|---|
| User profile | Redis | 5 min |
| Product list | Redis | 10 min |
| AI chat history | Redis | 1 hour |
| Subscription status | Redis | 2 min |
| Dashboard stats | Redis | 1 min |
| Static pages | Next.js ISR | 60 sec |
