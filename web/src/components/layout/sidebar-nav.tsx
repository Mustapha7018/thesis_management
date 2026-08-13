import { useQuery } from "@tanstack/react-query"
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
import { Link, useLocation, useSearchParams } from "react-router-dom"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { listCohorts } from "@/lib/services/cohort.service"
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

const adminNavBeforeCohort: NavItem[] = [
  { label: "Dashboard", to: routePaths.admin.home, icon: Gauge },
  { label: "Users", to: routePaths.admin.users, icon: UserCog },
]

const adminNavAfterCohort: NavItem[] = [
  { label: "Supervisors", to: routePaths.admin.supervisors, icon: Contact },
  { label: "Research areas", to: routePaths.admin.researchAreas, icon: Settings2 },
  { label: "Preference window", to: routePaths.admin.preferenceWindow, icon: CalendarClock },
  { label: "Run allocation", to: routePaths.admin.runAllocation, icon: Play },
  { label: "Compare runs", to: routePaths.admin.compareRuns, icon: GitCompareArrows },
  { label: "Publish", to: routePaths.admin.publish, icon: ShieldCheck },
  { label: "Audit log", to: routePaths.admin.auditLog, icon: ScrollText },
]

function NavItems({ items }: { items: NavItem[] }) {
  const location = useLocation()
  return (
    <>
      {items.map((item) => (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton asChild isActive={location.pathname === item.to}>
            <Link to={item.to}>
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  )
}

/** "Cohort" with the batch history (import + previous cohorts) as sub-items. */
function CohortNavItem() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const cohortsQuery = useQuery({ queryKey: ["cohorts"], queryFn: listCohorts })
  const cohorts = cohortsQuery.data ?? []

  const onCohortPage = location.pathname === routePaths.admin.cohort
  const selectedBatch = searchParams.get("batch")
  const activeCohortId = cohorts.find((c) => c.active)?.cohort_id

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={onCohortPage && selectedBatch === null}>
        <Link to={routePaths.admin.cohort}>
          <Upload className="size-4" />
          <span>Cohort</span>
        </Link>
      </SidebarMenuButton>
      {cohorts.length > 0 && (
        <SidebarMenuSub>
          {cohorts.map((c) => {
            const isActiveBatch = c.cohort_id === activeCohortId
            const to = isActiveBatch ? routePaths.admin.cohort : `${routePaths.admin.cohort}?batch=${c.cohort_id}`
            const isCurrent =
              onCohortPage && (selectedBatch === String(c.cohort_id) || (selectedBatch === null && isActiveBatch))
            return (
              <SidebarMenuSubItem key={c.cohort_id}>
                <SidebarMenuSubButton asChild isActive={isCurrent}>
                  <Link to={to}>
                    <span>
                      {c.label}
                      {isActiveBatch ? "" : " (archived)"}
                    </span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}

export function SidebarNav({ role }: { role: Role }) {
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Menu</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1.5">
            {role === "student" && <NavItems items={studentNav} />}
            {role === "supervisor" && <NavItems items={supervisorNav} />}
            {role === "admin" && (
              <>
                <NavItems items={adminNavBeforeCohort} />
                <CohortNavItem />
                <NavItems items={adminNavAfterCohort} />
              </>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
