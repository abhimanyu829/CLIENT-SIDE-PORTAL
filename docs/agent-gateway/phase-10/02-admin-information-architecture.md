# Phase 10 — Admin Information Architecture

Sidebar: **Agent Governance** (`/admin/agent-governance`, `superAdminOnly`, hidden from sub-admins; the server enforces access regardless of the sidebar).

| Section | Path | Shows | Actions |
|---|---|---|---|
| Overview | `/admin/agent-governance` | connections by status, pending approvals (+ oldest), tasks in flight and by outcome, active triggers by type, failing triggers; feature-switch notice | links into every section |
| Connections | `/connections` | filter status / environment / auth; paginated | register a connection (credential shown once) |
| Connection | `/connections/[id]` | identity, credentials (fingerprints only), autonomy editor + history, triggers, recent tasks, pending approvals | suspend, reactivate, rotate (shown once), revoke; edit / disable autonomy |
| Capabilities | `/capabilities` | the manifest: risk, exposure, status, async + retry class, mandatory approval, reversibility, live references | read-only |
| Policies | `/policies` | Phase 6 policies: state, current version, effect, scope, capability | create a policy |
| Policy | `/policies/[id]` | current version, conditions, full version history | publish version N+1, enable / disable, roll back |
| Autonomy | `/autonomy` | active autonomy policies (filter by level) + count of connections on the default observe-only posture | edit on the connection page |
| Approvals | `/approvals` | filter by effective status / connection; paginated | open the Phase 7 decision page |
| Tasks | `/tasks` | filter status / origin / capability / connection; paginated | — |
| Task | `/tasks/[ref]` | state, attempts, errors, links to trigger / approval, result present or removed (never the value) | cancel (when still possible) |
| Triggers | `/triggers` | filter type / status; paginated | create (draft) |
| Trigger | `/triggers/[ref]` | configuration, upcoming occurrences, endpoint, capability input, paginated runs with task links | activate, pause, resume, disable, revoke, rotate secret, edit while not firing |
| Schedules | `/schedules` | schedule triggers with cron / timezone / missed-run policy / next three runs | manage on the trigger page |
| Webhooks | `/webhooks` | webhook triggers with endpoint, secret version, 24 h deliveries, signing instructions | manage on the trigger page |
| Runtime | `/runtime` | switches, database / Redis / queue state, queue depth, stuck tasks, overdue schedules, backlog, limits | — |

## Conventions (reused from the existing admin panel)

- `?page=N`, fixed page size 20, "Page x of y · n total", Previous / Next links that keep the active filters.
- Filters are a native `GET` form (works without JavaScript), allowlisted values only; unknown values are ignored, never forwarded to a query.
- Components: `components/ui/*` (table, button, input, label, textarea, dialog), `ConfirmDialog` for dangerous actions, `useToast` for results.

## States

| State | Rendering |
|---|---|
| Empty | dashed notice ("No task matches these filters.") |
| Unavailable (storage error) | `role="alert"` notice; no internal detail |
| Not found / malformed reference | Next.js `notFound()` |
| Feature switched off | `role="note"` notice; configuration still reviewable |
| Forbidden | redirect to `/unauthorized` (`/login` when signed out) |
| Conflict (409) | toast "Changed by someone else", page refreshed |
| Validation (400) | inline `role="alert"` message |
