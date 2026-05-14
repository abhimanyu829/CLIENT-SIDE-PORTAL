# Skill: Content Writing

## UI Copy Prompt
```
Write UI copy for: [COMPONENT — e.g. "empty state on the projects page"]

Context:
- User: [WHO — e.g. "client who just signed up, has no projects yet"]
- Tone: Professional but friendly. Direct. No fluff.
- Brand voice: Confident, helpful, not corporate.

Write:
1. Headline (5-8 words max)
2. Subtext (1-2 sentences, explains the value of taking action)
3. CTA button text (2-4 words, action verb first)

Do NOT use: "Oops", "Uh oh", "Whoops", generic "Something went wrong"
DO use: specific, actionable, human language
```

## Error Message Prompt
```
Write error messages for these error codes:
[LIST OF error.code values]

Each error message must:
- Tell the user WHAT went wrong (specific, not "an error occurred")
- Tell them WHAT TO DO next
- Be under 20 words
- Never blame the user

Format: `{ code: "X", message: "User-facing message here" }`
```

## Email Subject Lines Prompt
```
Write 5 subject line variants for: [EMAIL TYPE — e.g. "subscription renewal reminder"]
- Recipient: [WHO]
- Goal: [WHAT ACTION WE WANT THEM TO TAKE]
- Tone: [e.g. "friendly urgency, not pushy"]
- Constraints: under 50 characters, no spam trigger words (FREE, URGENT, !!!)

Rank by predicted open rate and explain why #1 wins.
```

## Documentation Prompt
```
Write a runbook for: [PROCESS — e.g. "handling a failed payment"]

Format:
## Trigger
When does this runbook apply?

## Steps
Numbered, specific, actionable. No ambiguity.

## Expected Outcome
What does success look like?

## Escalation
If steps fail, who to contact and how.
```
