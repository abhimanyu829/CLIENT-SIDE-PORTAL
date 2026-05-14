# Task Prompt: Build Background Job

## Fill In and Send to Claude

```
Build BullMQ job at: jobs/[JOB_NAME].job.ts

Job name: [e.g., invoice, email, embedding]
Queue name: [matches lib/queue.ts export]
Trigger: [what API action enqueues this job]

Job data (payload):
[List fields in job.data — e.g., { userId: string, paymentId: string }]

Processing steps:
[List exactly what the job does, in order — e.g.,
1. Fetch payment + user from DB
2. Generate PDF with pdfkit
3. Upload PDF to R2 at path invoices/{userId}/{number}.pdf
4. Update Invoice.pdfUrl in DB
5. Queue email job with { userId, invoiceId }
6. Trigger Pusher notification to private-user-{userId}]

Error handling:
- Retry: [how many times — default 3]
- Backoff: [exponential — default 2s]
- On final failure: [log error + update DB status if needed]

Rules:
- No console.log — use logger
- Wrap all DB calls in try/catch
- Job must be idempotent (safe to run twice)
- No secrets hardcoded

Write the complete job file.
Also show how to enqueue it (one-liner for the calling API route).
```
