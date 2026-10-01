"use client"

import { useState } from "react"
import { ActionButton } from "./ActionButton"
import { SecretRevealDialog, type RevealedSecret } from "./SecretRevealDialog"

/**
 * Lifecycle actions for one agent connection, through the EXISTING Phase 2
 * routes (suspend / reactivate / revoke / rotate). Every action is confirmed;
 * revoke is terminal and also retires the connection's approvals and triggers.
 */
export function ConnectionActions({ connectionId, status }: { connectionId: string; status: string }) {
  const [secrets, setSecrets] = useState<RevealedSecret[] | null>(null)
  const base = `/api/admin/agent-connections/${encodeURIComponent(connectionId)}`

  return (
    <div className="flex flex-wrap gap-2">
      {status === "ACTIVE" ? (
        <ActionButton
          label="Suspend"
          url={`${base}/suspend`}
          successMessage="Connection suspended"
          confirm={{ title: "Suspend this connection?", description: "The agent is refused on its next request. Pending approvals are cancelled. You can reactivate it later." }}
        />
      ) : null}
      {status === "SUSPENDED" ? (
        <ActionButton
          label="Reactivate"
          url={`${base}/reactivate`}
          successMessage="Connection reactivated"
          confirm={{ title: "Reactivate this connection?", description: "The agent can authenticate again with its current credential. Old approvals stay cancelled." }}
        />
      ) : null}
      {status === "ACTIVE" ? (
        <ActionButton
          label="Rotate credential"
          url={`${base}/rotate`}
          successMessage="Credential rotated"
          confirm={{ title: "Rotate the credential?", description: "A new credential is issued and the current one stops working immediately. Update the agent before confirming." }}
          onSuccess={(data) => {
            const c = (data.credential ?? {}) as { bearerToken?: string; keyId?: string; signingSecret?: string }
            const shown: RevealedSecret[] = []
            if (c.bearerToken) shown.push({ label: "Bearer token", value: c.bearerToken })
            if (c.keyId) shown.push({ label: "Key id", value: c.keyId })
            if (c.signingSecret) shown.push({ label: "Signing secret", value: c.signingSecret })
            if (shown.length) setSecrets(shown)
          }}
        />
      ) : null}
      {status !== "REVOKED" ? (
        <ActionButton
          label="Revoke"
          url={`${base}/revoke`}
          successMessage="Connection revoked"
          confirm={{
            title: "Revoke this connection permanently?",
            description: "This cannot be undone. Credentials are revoked, pending approvals cancelled and every trigger of this connection revoked.",
            destructive: true,
            confirmLabel: "Revoke permanently",
          }}
        />
      ) : null}
      <SecretRevealDialog open={!!secrets} title="New connection credential" secrets={secrets ?? []} onClose={() => setSecrets(null)} />
    </div>
  )
}
