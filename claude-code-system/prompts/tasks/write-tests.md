# Task Prompt: Write Tests

## Fill In and Send to Claude

```
Write tests for: [FILE PATH]

Test type: [unit | integration | e2e]
Test file location: tests/[unit|integration]/[name].test.ts

What to test:
[List the functions/behaviors to test]

For each test case, cover:
1. Happy path — correct input, correct output
2. Edge cases — empty, null, zero, max values
3. Error cases — invalid input, missing auth, DB error
4. Security cases — unauthorized access, invalid tokens (for API routes)

Test setup:
- DB: [use test DB | mock Prisma with jest.mock | use prisma.$transaction rollback]
- External services: [mock Stripe | mock Resend | mock OpenAI with jest.mock]
- Auth: [mock getServerSession to return test user]

Rules:
- Each test is independent (no shared state)
- Descriptive test names: "should return 401 when user is not authenticated"
- Use describe blocks to group by function/feature
- Clean up DB after each test (afterEach)

Write all test cases. No placeholder tests.
```

## Quick Unit Test Template
```
describe('[FUNCTION NAME]', () => {
  it('should [EXPECTED BEHAVIOR] when [CONDITION]', async () => {
    // arrange
    const input = [TEST INPUT]
    // act  
    const result = await functionUnderTest(input)
    // assert
    expect(result).toEqual([EXPECTED])
  })
})
```
