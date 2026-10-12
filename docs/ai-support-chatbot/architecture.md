# Architecture
- Chat widget -> /api/ai-support/chat (auth+guest, rate 10/60s) -> retrieval -> answer + tools
- Knowledge: KnowledgeSource/Document/Chunk vector 1536 pgvector -> lexical fallback
- Tools: product/plan/order/subscription/ticket via existing services, scoped by userId
- Ticket: /api/ai-support/ticket -> existing Ticket + Notification, dedup per conversation
- Admin: /admin/knowledge, /api/admin/knowledge seed/ingest/deactivate
