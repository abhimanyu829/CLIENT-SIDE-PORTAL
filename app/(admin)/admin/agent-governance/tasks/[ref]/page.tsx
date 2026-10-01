import Link from "next/link"
import { notFound } from "next/navigation"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { getTaskDetail } from "@/lib/agent-gateway/governance/queries"
import { isCancellableTask, type TaskAdminView } from "@/lib/agent-gateway/governance/views"
import { ActionButton } from "@/components/admin/agent-governance/ActionButton"
import { KeyValues, Mono, SectionHeader, StatusPill, Time, Unavailable } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

export default async function GovernanceTaskDetailPage({ params }: { params: Promise<{ ref: string }> }) {
  await requireGovernanceViewer()
  const { ref } = await params
  if (!/^atk_[0-9a-f]{32}$/.test(ref)) notFound()
  let task: TaskAdminView | null = null
  let unavailable = false
  try {
    task = await getTaskDetail(ref)
  } catch {
    unavailable = true
  }
  if (unavailable) return <Unavailable what="This task" />
  if (!task) notFound()

  return (
    <section aria-labelledby="task-heading" className="space-y-6">
      <SectionHeader id="task-heading" title={`Task ${task.taskRef}`} description={`${task.capabilityId}@v${task.capabilityVersion} · ${task.origin === "TRIGGER" ? "created by a trigger" : "submitted by an agent"}`}>
        {isCancellableTask(task) ? (
          <ActionButton
            label="Cancel task"
            url={`/api/admin/agent-governance/tasks/${task.taskRef}/cancel`}
            body={{ expectedStatus: task.status }}
            successMessage="Cancellation submitted"
            confirm={{
              title: "Cancel this task?",
              description:
                task.status === "RUNNING"
                  ? "It is running. Only capabilities that support cooperative cancellation can be stopped; otherwise the request is reported as unavailable and the task finishes normally."
                  : "It will not run (or will not be retried).",
              destructive: true,
              requireReason: true,
            }}
          />
        ) : null}
      </SectionHeader>
      <KeyValues
        items={[
          { label: "Status", value: <StatusPill status={task.status} /> },
          { label: "Attempts", value: `${task.attempts} of ${task.maxAttempts}${task.retryScheduled ? " (retry scheduled)" : ""}` },
          { label: "Retry class", value: task.retryClass.replace(/_/g, " ").toLowerCase() },
          { label: "Error", value: task.errorCode ? `${task.errorCode}${task.errorDetailCode ? ` (${task.errorDetailCode})` : ""}` : "—" },
          { label: "Connection", value: <Link className="underline font-mono text-xs" href={`/admin/agent-governance/connections/${task.connectionId}`}>{task.connectionId}</Link> },
          { label: "Owner", value: <Mono>{task.ownerId}</Mono> },
          { label: "Environment", value: task.environment },
          { label: "Adapter", value: <Mono>{task.adapterId}</Mono> },
          { label: "Resource", value: task.resourceType ? `${task.resourceType}:${task.resourceId ?? "-"}` : "—" },
          { label: "Trigger", value: task.triggerRef ? <Link className="underline font-mono text-xs" href={`/admin/agent-governance/triggers/${task.triggerRef}`}>{task.triggerRef}</Link> : "—" },
          { label: "Approval", value: task.approvalRef ? <Link className="underline font-mono text-xs" href={`/admin/agent-approvals/${task.approvalRef}`}>{task.approvalRef}</Link> : "—" },
          { label: "Idempotency key", value: task.hasIdempotencyKey ? "provided" : "none" },
          { label: "Result", value: task.resultState === "STORED" ? "stored (visible to the owning agent only)" : task.resultState === "REMOVED" ? "removed by retention" : "none" },
          { label: "Created", value: <Time value={task.createdAt} /> },
          { label: "Started", value: <Time value={task.startedAt} /> },
          { label: "Finished", value: <Time value={task.finishedAt} /> },
          { label: "Deadline", value: <Time value={task.expiresAt} /> },
        ]}
      />
    </section>
  )
}
