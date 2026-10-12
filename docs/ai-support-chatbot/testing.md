# Tests
- Unit: chunking, security redact, isPromptInjection
- Integration: chat guest/auth scope, ticket dedup, rate limit
- Security: prompt injection treated as content, no cross-customer leak, secrets never to client
- Run: npx tsc --noEmit (pre-existing 3 errors only), prisma generate, build pool-limited unverified on local Supabase 15 pool
