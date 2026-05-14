# Core

## Purpose
Foundational modules shared across the entire application.
These are the lowest-level building blocks — no dependencies on other `src/` modules.

## What Belongs Here
- Base classes and interfaces
- Core error types and error handling utilities
- Logging setup
- Configuration management
- Shared constants

## Prompt to Generate a Core Module
```
Generate a core module at src/core/[NAME].ts

This module is foundational — it has no dependencies on other src/ modules.
It exports: [LIST EXPORTS]
It must be:
- Framework-agnostic (no Next.js imports)
- Purely functional where possible
- Fully typed with TypeScript strict
- Tested in tests/unit/[name].test.ts

Write the complete module and its test file.
```
