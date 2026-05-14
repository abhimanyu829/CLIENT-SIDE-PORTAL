#!/bin/bash
# Health check script — run before any deploy

echo "=== Pre-deploy Health Check ==="

# TypeScript
echo "→ TypeScript check..."
npx tsc --noEmit
if [ $? -ne 0 ]; then echo "❌ TypeScript errors found. Fix before deploying."; exit 1; fi
echo "✅ TypeScript OK"

# Lint
echo "→ ESLint check..."
npx eslint . --max-warnings=0
if [ $? -ne 0 ]; then echo "❌ Lint errors found. Fix before deploying."; exit 1; fi
echo "✅ Lint OK"

# Tests
echo "→ Running tests..."
npm test -- --passWithNoTests
if [ $? -ne 0 ]; then echo "❌ Tests failed. Fix before deploying."; exit 1; fi
echo "✅ Tests OK"

# Env vars
echo "→ Checking env vars..."
node -e "require('./lib/env.ts')" 2>&1
if [ $? -ne 0 ]; then echo "❌ Missing env vars. Check .env.example."; exit 1; fi
echo "✅ Env vars OK"

echo ""
echo "=== All checks passed. Safe to deploy. ==="
