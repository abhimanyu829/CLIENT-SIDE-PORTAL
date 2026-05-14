# Prompt: Technical Spike / Experiment

## Use This When
You want to explore a new library, approach, or integration before committing to it.

## Spike Prompt
```
SPIKE: Explore [TECHNOLOGY/APPROACH] for [USE CASE]

Time-box: [e.g., 2 hours]
Question to answer: [What specific decision does this spike inform?]

Explore:
1. Minimal working example — get it working in isolation
2. Integration points — how does it connect to our stack?
3. Limitations — what does it NOT do that we need?
4. Alternatives considered — why this over X?

Deliverable:
- Working code snippet (not production-ready, just proof of concept)
- Go / No-go recommendation with reasoning
- If Go: estimated effort to productionize
- If No-go: recommended alternative

Location: experiments/prototypes/[spike-name]/
Document outcome in: experiments/[spike-name]-outcome.md
```

## Experiment Log Format
```
# Spike: [NAME]
Date: [DATE]
Question: [DECISION THIS INFORMED]
Result: [GO / NO-GO]
Reasoning: [2-3 sentences]
Next step: [What we're doing as a result]
```
