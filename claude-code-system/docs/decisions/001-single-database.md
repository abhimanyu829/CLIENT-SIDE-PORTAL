# ADR 001 — Single Database (PostgreSQL only)

## Status: Accepted

## Context
Original design used PostgreSQL + MongoDB + Redis.
MongoDB was used only for chat messages and logs.

## Decision
Use PostgreSQL for everything. Replace MongoDB chat collections with `ChatRoom` and `ChatMessage` Prisma models. Use Pino + structured logging for logs (no MongoDB needed).

## Consequences
✅ One less database to manage, connect pool, monitor
✅ Joins work across all data (e.g., ticket messages + user data)
✅ pgvector extension handles AI embeddings in the same DB
✅ One backup strategy for all data
❌ PostgreSQL JSONB is slightly less flexible than MongoDB documents (acceptable trade-off)

## Revisit Trigger
If chat volume exceeds 10M messages/day and PostgreSQL write throughput becomes the bottleneck.
