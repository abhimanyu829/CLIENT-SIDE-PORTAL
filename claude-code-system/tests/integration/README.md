# Integration Tests

## What Goes Here
Tests that hit the real DB (test database), real Redis, but mock external services (Stripe, Resend, OpenAI, Pusher).

## Setup
```bash
# Requires a test DB:
DATABASE_URL_TEST=postgresql://localhost:5432/saas_test

# Apply schema to test DB:
DATABASE_URL=$DATABASE_URL_TEST npx prisma db push
```

## Run
```bash
npm test -- tests/integration/
```

## Writing Integration Tests
Use the prompt in: `prompts/tasks/write-tests.md` with type: integration

## Pattern
```ts
beforeEach(async () => {
  await db.$transaction(async (tx) => {
    // seed minimal test data
  })
})

afterEach(async () => {
  await db.$executeRaw`TRUNCATE TABLE "User" CASCADE`
})
```

## What to Test
- API routes: full request → DB → response cycle
- Background jobs: enqueue → process → verify DB state
- Auth flows: register → login → access protected route
- Payment flows: checkout → webhook → subscription created
