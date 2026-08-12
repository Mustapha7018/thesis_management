import {
  CalendarClock,
  ClipboardList,
  Contact,
  FileCheck2,
  Gauge,
  GitCompareArrows,
  KanbanSquare,
  ListChecks,
  Play,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCog,
  Users,
} from "lucide-react"
import type { ComponentType } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { routePaths } from "@/routes/route-paths"
import type { Role } from "@/lib/types/entities"

interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
}

const studentNav: NavItem[] = [
  { label: "Dashboard", to: routePaths.student.home, icon: Gauge },
  { label: "Interests", to: routePaths.student.interests, icon: Sparkles },
  { label: "Supervisor preferences", to: routePaths.student.preferences, icon: ListChecks },
  { label: "Allocation", to: routePaths.student.allocation, icon: FileCheck2 },
  { label: "Agile board", to: routePaths.student.agile, icon: KanbanSquare },
  { label: "Sprints", to: routePaths.student.sprints, icon: ClipboardList },
  { label: "Milestones", to: routePaths.student.milestones, icon: ScrollText },
  { label: "Meetings", to: routePaths.student.meetings, icon: CalendarClock },
]

const supervisorNav: NavItem[] = [
  { label: "Dashboard", to: routePaths.supervisor.home, icon: Gauge },
  { label: "Expertise", to: routePaths.supervisor.expertise, icon: Sparkles },
  { label: "Applicants", to: routePaths.supervisor.applicants, icon: Users },
  { label: "Allocation", to: routePaths.supervisor.allocation, icon: FileCheck2 },
  { label: "Meetings", to: routePaths.supervisor.meetings, icon: CalendarClock },
]

const adminNav: NavItem[] = [
  { label: "Dashboard", to: routePaths.admin.home, icon: Gauge },
  { label: "Users", to: routePaths.admin.users, icon: UserCog },
  { label: "Cohort", to: routePaths.admin.cohort, icon: Upload },
  { label: "Supervisors", to: routePaths.admin.supervisors, icon: Contact },
  { label: "Research areas", to: routePaths.admin.researchAreas, icon: Settings2 },
  { label: "Preference window", to: routePaths.admin.preferenceWindow, icon: CalendarClock },
  { label: "Run allocation", to: routePaths.admin.runAllocation, icon: Play },
  { label: "Compare runs", to: routePaths.admin.compareRuns, icon: GitCompareArrows },
  { label: "Publish", to: routePaths.admin.publish, icon: ShieldCheck },
  { label: "Audit log", to: routePaths.admin.auditLog, icon: ScrollText },
]

const navByRole: Record<Role, NavItem[]> = {
  student: studentNav,
  supervisor: supervisorNav,
  admin: adminNav,
}

export function SidebarNav({ role }: { role: Role }) {
  const location = useLocation()
  const items = navByRole[role]

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Menu</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1.5">
            {items.map((item) => {
              const isActive = location.pathname === item.to
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
