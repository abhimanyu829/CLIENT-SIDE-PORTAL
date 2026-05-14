# Skill: Product Ideation

## Feature Ideation Prompt
```
We are building a SaaS + AI Marketplace. 
Current users: [PERSONA — e.g. "indie developers buying AI tools"]
Problem observed: [WHAT PAIN ARE WE SOLVING]

Generate 5 feature ideas that:
1. Can be built in < 1 sprint (1-2 weeks)
2. Directly reduce churn OR increase conversion OR increase MRR
3. Fit within our current stack (no new services)
4. Don't require hiring

For each idea:
- Name: one-line title
- Problem solved: one sentence
- Implementation: 3-5 bullet points (what to build)
- Metric to measure success: specific KPI
- Effort: S / M / L
- Impact: Low / Medium / High

Rank by Impact/Effort ratio. Recommend the top 2.
```

## MVP Scoping Prompt
```
Feature: [FEATURE NAME]
Full vision: [DESCRIBE THE BIG IDEA]

Scope it to an MVP that:
- Can ship in [TIMEFRAME]
- Validates the core hypothesis: [WHAT ARE WE TRYING TO LEARN]
- Cuts everything that doesn't directly test the hypothesis

MVP scope:
- Must have: [LIST]
- Nice to have (v2): [LIST]
- Out of scope forever: [LIST]

What assumption does this MVP validate or invalidate?
```

## Prioritization Framework
Score each candidate feature:
- **Reach**: how many users affected (1-5)
- **Impact**: how much it moves the metric (1-5)  
- **Confidence**: how sure we are it works (1-5)
- **Effort**: how long to build — inverse (5=easy, 1=hard)

**RICE score = (Reach × Impact × Confidence) / Effort**

Build highest RICE score first.
