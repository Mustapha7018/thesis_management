import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable } from "@/components/common/data-table"
import type { AdminUserRow, Paginated } from "@/lib/types/dto"

export function UserTable({
  data,
  onPageChange,
  onToggleActive,
  onEditAdmin,
  onDeleteAdmin,
  currentAccountId,
}: {
  data: Paginated<AdminUserRow>
  onPageChange: (page: number) => void
  onToggleActive: (accountId: string, active: boolean) => Promise<void>
  onEditAdmin?: (row: AdminUserRow) => void
  onDeleteAdmin?: (accountId: string) => Promise<void>
  currentAccountId?: string
}) {
  return (
    <DataTable
      data={data}
      getRowKey={(row) => row.account_id}
      onPageChange={onPageChange}
      emptyTitle="No users match this filter"
      columns={[
        { header: "Name", cell: (row) => row.display_name },
        { header: "Email", cell: (row) => <span className="text-muted-foreground">{row.email}</span> },
        {
          header: "Role",
          cell: (row) => (
            <Badge variant="secondary" className="capitalize">
              {row.role}
            </Badge>
          ),
        },
        {
          header: "Status",
          cell: (row) => (
            <Badge className={row.active ? "bg-success text-success-foreground border-transparent" : "bg-muted text-muted-foreground border-transparent"}>
              {row.active ? "Active" : "Retired"}
            </Badge>
          ),
        },
        {
          header: "",
          className: "text-right",
          cell: (row) => {
            if (row.role !== "admin") {
              return (
                <Button variant="outline" size="sm" onClick={() => onToggleActive(row.account_id, !row.active)}>
                  {row.active ? "Retire" : "Reactivate"}
                </Button>
              )
            }
            const isSelf = row.account_id === currentAccountId
            return (
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => onEditAdmin?.(row)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSelf && row.active}
                  title={isSelf && row.active ? "You cannot retire your own account." : undefined}
                  onClick={() => onToggleActive(row.account_id, !row.active)}
                >
                  {row.active ? "Retire" : "Reactivate"}
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isSelf}
                      title={isSelf ? "You cannot delete your own account." : undefined}
                    >
                      Delete
                    </Button>
                  }
                  title={`Delete admin ${row.display_name}?`}
                  description="This permanently removes the admin account and its login. This cannot be undone."
                  confirmLabel="Delete admin"
                  destructive
                  onConfirm={() => onDeleteAdmin?.(row.account_id)}
                />
              </div>
            )
          },
        },
      ]}
    />
  )
}
