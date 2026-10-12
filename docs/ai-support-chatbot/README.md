# AI Support Chatbot
RAG chatbot grounded in approved knowledge + live tools, existing tickets/notifications, no OpenWA.
## Setup
- OPENAI_API_KEY required, AI_SUPPORT_* optional defaults in lib/env.ts
- Seed: POST /api/admin/knowledge {seed:true}
- Ingest: PATCH /api/admin/knowledge?id=...&action=ingest
