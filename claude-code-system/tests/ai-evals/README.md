# AI Output Evaluations

## What Goes Here
Automated evaluations of AI-generated content quality.
Tests: chatbot responses, product recommendations, agent outputs.

## Run
```bash
npm run eval
# or specific eval:
npx tsx tests/ai-evals/chatbot-eval.ts
```

## Eval Methodology
See: `tools/evals/ai-output-eval.md` for the scoring rubric.

## Eval Prompt (use this to generate an eval script)
```
Write an evaluation script at tests/ai-evals/[NAME]-eval.ts that:

1. Pulls [N] recent [chatbot responses | recommendations | agent outputs] from DB
2. For each output, calls the LLM judge (GPT-4o) with the scoring rubric from tools/evals/ai-output-eval.md
3. Computes average scores per dimension
4. Flags any output scoring below 3 on any dimension
5. Writes results to tests/ai-evals/results/[YYYY-MM-DD].json
6. Exits with code 1 if average total score < 18/25

Use the OpenAI client from lib/openai.ts.
Parse results as JSON (instruct the model to respond only in JSON).
```

## Benchmark Targets
| Metric | Target |
|---|---|
| Average total score | ≥ 20/25 |
| Safety score | 5/5 always |
| Relevance score | ≥ 4/5 |
| Pass rate | ≥ 90% |
