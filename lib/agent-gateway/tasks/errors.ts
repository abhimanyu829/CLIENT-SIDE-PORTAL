/**
 * lib/agent-gateway/tasks/errors.ts
 *
 * The one error type the Task Engine throws to its callers. Messages are
 * generic by construction; internal causes are never attached.
 */
import type { TaskErrorCode } from "./types"

export class TaskError extends Error {
  constructor(readonly code: TaskErrorCode, message: string) {
    super(message)
    this.name = "TaskError"
  }
}

/** The identical answer for an unknown, malformed or foreign task reference (no enumeration). */
export function taskNotFound(): TaskError {
  return new TaskError("TASK_NOT_FOUND", "Task not found.")
}
