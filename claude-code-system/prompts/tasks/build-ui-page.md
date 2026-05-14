# Task Prompt: Build UI Page

## Fill In and Send to Claude

```
Build page at: app/[ROUTE_GROUP]/[PAGE]/page.tsx

Page name: [e.g., Subscriptions]
Route group: [(dashboard) | (admin) | (public) | (auth)]
Rendering: [SSR | ISR | CSR | Server Component]
Auth required: [yes/no, role]

Layout:
[Describe the layout — e.g., "Table with filters on top, cards below, empty state when no data"]

Data sources:
[List API endpoints this page calls, e.g., GET /api/subscriptions]

Components to use (from components/):
[List existing components this page uses]

New components to create (if any):
[List component names and their responsibility]

States to handle:
- Loading: [describe skeleton or spinner]
- Error: [describe error message]
- Empty: [describe empty state with CTA]
- Success: [describe normal state]

Actions:
[List user actions — e.g., "Cancel subscription button → opens modal → calls PATCH /api/subscriptions/[id]"]

Rules:
- Mobile-first, dark mode
- react-hook-form + Zod for any forms
- React Query for data fetching (useQuery / useMutation)
- Zustand for client state if needed
- Shadcn/UI components
- No inline styles — Tailwind only

Write all files completely. No stubs.
```
