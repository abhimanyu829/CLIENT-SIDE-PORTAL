# Failed Ideas

## Purpose
Document ideas we tried and discarded — so we don't revisit them without a good reason.

## Format
```
# [Idea Name]
Date: [when tried]
What we tried: [description]
Why it failed: [specific reason]
What we learned: [takeaway]
Revisit if: [conditions under which this might make sense later]
```

## Log

### Microservices Architecture
Date: Project start
What we tried: 12+ services, Turborepo, Kafka, AWS ECS
Why it failed: Too complex for current team size and scale. 2x longer to ship features.
What we learned: Modular monolith ships faster and is easier to debug at <50k MAU.
Revisit if: Team > 8 engineers, need separate deploy cadences, at 50k+ MAU.

### MongoDB for Chat
Date: Project start
What we tried: Separate MongoDB instance for chat messages
Why it failed: Adds operational complexity. PostgreSQL handles it fine with ChatRoom/ChatMessage tables.
What we learned: Don't add a new database unless you have a concrete reason PostgreSQL can't do it.
Revisit if: Chat volume > 10M messages/day and PostgreSQL becomes the bottleneck.
