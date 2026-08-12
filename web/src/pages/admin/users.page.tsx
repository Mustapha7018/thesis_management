import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Search } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AdminFormDialog, type AdminDialogState } from "@/components/admin/admin-form-dialog"
import { UserTable } from "@/components/admin/user-table"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/context/auth-context"
import { createAdmin, deleteAdmin, listUsers, setAdminActive, setUserActive, updateAdmin } from "@/lib/services/admin.service"
import type { Role } from "@/lib/types/entities"

export function UsersPage() {
  const [role, setRole] = useState<Role | "all">("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [adminDialog, setAdminDialog] = useState<AdminDialogState | null>(null)
  const queryClient = useQueryClient()
  const { session } = useAuth()

  const usersQuery = useQuery({
    queryKey: ["admin-users", role, search, page],
    queryFn: () =>
      listUsers({
        page,
        limit: 20,
        filter: { ...(role === "all" ? {} : { role }), ...(search ? { search } : {}) },
      }),
  })

  async function invalidateUsers() {
    await queryClient.invalidateQueries({ queryKey: ["admin-users"] })
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="All students, supervisors and admins in the system."
        actions={
          <Button size="sm" onClick={() => setAdminDialog({ mode: "create" })}>
            <Plus className="size-4" />
            New admin
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56 max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Tabs
          value={role}
          onValueChange={(v) => {
            setRole(v as Role | "all")
            setPage(1)
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="student">Students</TabsTrigger>
            <TabsTrigger value="supervisor">Supervisors</TabsTrigger>
            <TabsTrigger value="admin">Admins</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {usersQuery.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <UserTable
          data={usersQuery.data!}
          onPageChange={setPage}
          currentAccountId={session?.account_id}
          onToggleActive={async (accountId, active) => {
            try {
              const row = usersQuery.data!.data.find((u) => u.account_id === accountId)
              await (row?.role === "admin" ? setAdminActive(accountId, active) : setUserActive(accountId, active))
              await invalidateUsers()
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to update account.")
            }
          }}
          onEditAdmin={(user) => setAdminDialog({ mode: "edit", user })}
          onDeleteAdmin={async (accountId) => {
            try {
              await deleteAdmin(accountId)
              await invalidateUsers()
              toast.success("Admin deleted.")
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to delete admin.")
            }
          }}
        />
      )}
      <AdminFormDialog
        state={adminDialog}
        onOpenChange={(open) => {
          if (!open) setAdminDialog(null)
        }}
        onSubmit={async (values) => {
          if (adminDialog?.mode === "edit") {
            await updateAdmin(adminDialog.user.account_id, values)
          } else {
            await createAdmin(values)
          }
          await invalidateUsers()
        }}
      />
    </div>
  )
}
