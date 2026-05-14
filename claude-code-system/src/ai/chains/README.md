# AI Chains

## Purpose
Reusable LLM chains — composed prompts that perform multi-step AI reasoning.

## What Belongs Here
- `chat-chain.ts` — conversation chain with memory
- `recommendation-chain.ts` — product recommendation reasoning
- `summarize-chain.ts` — summarize long content
- `extract-chain.ts` — extract structured data from unstructured text

## Prompt to Build a Chain
```
Build an AI chain at src/ai/chains/[NAME]-chain.ts

Purpose: [what this chain does]
Input: [what data it receives]
Output: [what it returns — JSON shape]

Chain steps:
1. [Step 1 — e.g., fetch context from DB]
2. [Step 2 — e.g., build prompt with context]
3. [Step 3 — e.g., call OpenAI with structured output]
4. [Step 4 — e.g., parse and validate response with Zod]

Rules:
- Use lib/openai.ts (has retry logic built in)
- Always validate AI output with Zod before returning
- If AI output is malformed, retry once then throw ChainError
- Log chain execution time with logger
- No hardcoded prompts — prompts live in prompts/ directory

Write the complete chain file.
```
