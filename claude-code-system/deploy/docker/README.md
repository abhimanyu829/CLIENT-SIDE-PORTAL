# Docker

## Note
Primary deployment is Railway (no Docker needed for Railway Nixpacks builds).
Docker config here is for: local dev parity, self-hosted fallback, staging environment.

## Prompt to Generate Dockerfile
```
Generate a production Dockerfile for our Next.js 14 app:
- Base image: node:20-alpine
- Multi-stage build: deps → builder → runner
- Runner stage: non-root user, only production files
- Expose port 3000
- CMD: node server.js (Next.js standalone output)
- Add .dockerignore: node_modules, .next, .git, tests, docs

Also generate docker-compose.yml for local dev:
Services:
- app: Next.js (build from Dockerfile)
- worker: same image, command: npm run worker
- db: postgres:16-alpine, volume for data persistence
- redis: redis:7-alpine
Environment variables from .env file.
```

## Build & Run
```bash
docker build -t saas-app .
docker compose up -d
docker compose logs -f app
```
