# CI Pipeline

## GitHub Actions Workflow
Located at: `.github/workflows/ci.yml`

## Pipeline Steps
```yaml
# Trigger: push to main or PR to main
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      1. Checkout code
      2. Setup Node.js 20
      3. Install dependencies (npm ci)
      4. Run TypeScript check (tsc --noEmit)
      5. Run ESLint (eslint . --max-warnings=0)
      6. Run tests (npm test)
      7. Build (npm run build) — catches Next.js build errors
      
  deploy:
    needs: ci
    if: github.ref == 'refs/heads/main'
    steps:
      1. Deploy to Railway (railway up --detach)
```

## Adding a New Check to CI
```
Edit .github/workflows/ci.yml.
Add the step BEFORE the build step.
Make sure the command exits with code 1 on failure (most CLIs do this by default).
Test locally first: run the command manually and verify it catches errors.
```

## Prompt to Generate CI Config
```
Generate a GitHub Actions CI workflow for our Next.js app that:
1. Runs on: push to main, PRs to main
2. Node version: 20
3. Steps: install, typecheck, lint, test, build
4. Deploy to Railway on main branch only
5. Uses: RAILWAY_TOKEN secret from GitHub secrets
6. Fails fast — stop on first error
Write the complete .github/workflows/ci.yml file.
```
