import { useMemo } from "react"
import { listDemoAccounts } from "@/lib/services/auth.service"
import type { Role } from "@/lib/types/entities"

const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  supervisor: "Supervisor",
  admin: "Admin",
}

export function DemoAccountPicker({ onSelect }: { onSelect: (email: string) => void }) {
  const accounts = useMemo(() => listDemoAccounts(), [])
  const byRole = useMemo(() => {
    const groups: Record<Role, typeof accounts> = { student: [], supervisor: [], admin: [] }
    for (const a of accounts) groups[a.role].push(a)
    return groups
  }, [accounts])

  return (
    <div className="space-y-3">
      {(Object.keys(byRole) as Role[]).map((role) => (
        <div key={role}>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {ROLE_LABELS[role]}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {byRole[role].map((account) => (
              <button
                key={account.account_id}
                type="button"
                title={account.email}
                onClick={() => onSelect(account.email)}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
              >
                {account.display_name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
