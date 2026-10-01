"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { ActionButton } from "./ActionButton"
import { selectClass } from "./ui"

/** Kill switch and rollback for one Phase 6 policy (both confirmed; rollback publishes a copy as a new version). */
export function PolicyActions({ policyId, enabled, latestVersion, versions }: { policyId: string; enabled: boolean; latestVersion: number; versions: number[] }) {
  const earlier = versions.filter((v) => v < latestVersion).sort((a, b) => b - a)
  const [target, setTarget] = useState<number | null>(earlier[0] ?? null)
  const base = `/api/admin/agent-governance/policies/${encodeURIComponent(policyId)}`

  return (
    <div className="flex flex-wrap items-end gap-3">
      {enabled ? (
        <ActionButton
          label="Disable policy"
          url={`${base}/disable`}
          body={{}}
          successMessage="Policy disabled"
          confirm={{ title: "Disable this policy?", description: "It stops matching on the next authorization. If it was the only allow for an operation, that operation is denied by default.", destructive: true, requireReason: true }}
        />
      ) : (
        <ActionButton
          label="Enable policy"
          url={`${base}/enable`}
          body={{}}
          successMessage="Policy enabled"
          confirm={{ title: "Enable this policy?", description: "Its current version matches again from the next authorization.", requireReason: true }}
        />
      )}
      {earlier.length > 0 && target !== null ? (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="rollback-target">Roll back to</Label>
            <select id="rollback-target" className={selectClass} value={target} onChange={(e) => setTarget(Number(e.target.value))}>
              {earlier.map((v) => (
                <option key={v} value={v}>
                  version {v}
                </option>
              ))}
            </select>
          </div>
          <ActionButton
            label="Roll back"
            url={`${base}/rollback`}
            body={{ targetVersion: target, expectedCurrentVersion: latestVersion }}
            successMessage={`Rolled back: version ${target} republished as version ${latestVersion + 1}`}
            confirm={{ title: `Roll back to version ${target}?`, description: `Version ${target} is copied into a new version ${latestVersion + 1}. History is kept.`, requireReason: true }}
          />
        </div>
      ) : null}
    </div>
  )
}
