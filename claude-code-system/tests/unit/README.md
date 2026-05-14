# Unit Tests

## What Goes Here
Pure function tests — no DB, no network, no filesystem.
Test: lib/ utilities, business logic functions, Zod schemas, helper functions.

## Run
```bash
npm test -- tests/unit/
```

## Writing Unit Tests
Use the prompt in: `prompts/tasks/write-tests.md`

## Naming Convention
`tests/unit/[lib-name].test.ts`
Examples: `utils.test.ts`, `encryption.test.ts`, `permissions.test.ts`

## Mock Strategy
- External services: `jest.mock('lib/stripe', () => ({ createCheckoutSession: jest.fn() }))`
- Env vars: set in `jest.config.ts` → `testEnvironment: 'node'`, env in `jest.setup.ts`
- Time: `jest.useFakeTimers()` for date-dependent logic
