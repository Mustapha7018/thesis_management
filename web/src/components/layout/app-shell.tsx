import { RotateCcw } from "lucide-react"
import { Outlet } from "react-router-dom"
import { SunderlandMark } from "@/components/brand/sunderland-mark"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/context/auth-context"
import { resetDemoData } from "@/lib/services/db/store"

export function AppShell() {
  const { session } = useAuth()
  if (!session) return null

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <SunderlandMark className="size-7 shrink-0 text-sidebar-foreground" />
            <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold">Thesis Portal</span>
              <span className="truncate text-xs text-sidebar-foreground/70">University of Sunderland</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarNav role={session.role} />
        <SidebarFooter>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="justify-start gap-2 text-sidebar-foreground/70">
                <RotateCcw className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden">Reset demo data</span>
              </Button>
            }
            title="Reset demo data?"
            description="This restores every table to its original seeded state. Any changes you've made in this session (interests, tasks, meetings, allocation runs, etc.) will be lost."
            confirmLabel="Reset"
            destructive
            onConfirm={() => {
              resetDemoData()
              window.location.reload()
            }}
          />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
