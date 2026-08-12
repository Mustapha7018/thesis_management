import { createBrowserRouter } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { RequireAuth, RequireRole } from "@/components/layout/route-guard"
import { LoginPage } from "@/pages/auth/login.page"
import { NotFoundPage } from "@/pages/shared/not-found.page"

import { StudentDashboardPage } from "@/pages/student/student-dashboard.page"
import { ProfileInterestsPage } from "@/pages/student/profile-interests.page"
import { ProfilePreferencesPage } from "@/pages/student/profile-preferences.page"
import { StudentAllocationPage } from "@/pages/student/allocation-result.page"
import { AgileBoardPage } from "@/pages/student/agile-board.page"
import { SprintsPage } from "@/pages/student/sprints.page"
import { MilestonesPage } from "@/pages/student/milestones.page"
import { StudentMeetingsPage } from "@/pages/student/meetings.page"

import { SupervisorDashboardPage } from "@/pages/supervisor/supervisor-dashboard.page"
import { ExpertisePage } from "@/pages/supervisor/expertise.page"
import { ApplicantsPage } from "@/pages/supervisor/applicants.page"
import { SupervisorAllocationPage } from "@/pages/supervisor/allocation-result.page"
import { StudentDetailPage } from "@/pages/supervisor/student-detail.page"
import { SupervisorMeetingsPage } from "@/pages/supervisor/meetings.page"

import { AdminDashboardPage } from "@/pages/admin/admin-dashboard.page"
import { UsersPage } from "@/pages/admin/users.page"
import { CohortPage } from "@/pages/admin/cohort.page"
import { SupervisorsPage } from "@/pages/admin/supervisors.page"
import { SupervisorDetailPage } from "@/pages/admin/supervisor-detail.page"
import { ResearchAreasPage } from "@/pages/admin/research-areas.page"
import { PreferenceWindowPage } from "@/pages/admin/preference-window.page"
import { RunAllocationPage } from "@/pages/admin/run-allocation.page"
import { CompareRunsPage } from "@/pages/admin/compare-runs.page"
import { PublishPage } from "@/pages/admin/publish.page"
import { AuditLogPage } from "@/pages/admin/audit-log.page"

import { Navigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { homeForRole, routePaths } from "@/routes/route-paths"

function IndexRedirect() {
  const { session } = useAuth()
  return <Navigate to={session ? homeForRole(session.role) : routePaths.login} replace />
}

export const router = createBrowserRouter([
  { path: "/", element: <IndexRedirect /> },
  { path: routePaths.login, element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            element: <RequireRole role="student" />,
            children: [
              { path: routePaths.student.home, element: <StudentDashboardPage /> },
              { path: routePaths.student.interests, element: <ProfileInterestsPage /> },
              { path: routePaths.student.preferences, element: <ProfilePreferencesPage /> },
              { path: routePaths.student.allocation, element: <StudentAllocationPage /> },
              { path: routePaths.student.agile, element: <AgileBoardPage /> },
              { path: routePaths.student.sprints, element: <SprintsPage /> },
              { path: routePaths.student.milestones, element: <MilestonesPage /> },
              { path: routePaths.student.meetings, element: <StudentMeetingsPage /> },
            ],
          },
          {
            element: <RequireRole role="supervisor" />,
            children: [
              { path: routePaths.supervisor.home, element: <SupervisorDashboardPage /> },
              { path: routePaths.supervisor.expertise, element: <ExpertisePage /> },
              { path: routePaths.supervisor.applicants, element: <ApplicantsPage /> },
              { path: routePaths.supervisor.allocation, element: <SupervisorAllocationPage /> },
              { path: "/supervisor/students/:studentId", element: <StudentDetailPage /> },
              { path: routePaths.supervisor.meetings, element: <SupervisorMeetingsPage /> },
            ],
          },
          {
            element: <RequireRole role="admin" />,
            children: [
              { path: routePaths.admin.home, element: <AdminDashboardPage /> },
              { path: routePaths.admin.users, element: <UsersPage /> },
              { path: routePaths.admin.cohort, element: <CohortPage /> },
              { path: routePaths.admin.supervisors, element: <SupervisorsPage /> },
              { path: "/admin/supervisors/:supervisorId", element: <SupervisorDetailPage /> },
              { path: routePaths.admin.researchAreas, element: <ResearchAreasPage /> },
              { path: routePaths.admin.preferenceWindow, element: <PreferenceWindowPage /> },
              { path: routePaths.admin.runAllocation, element: <RunAllocationPage /> },
              { path: routePaths.admin.compareRuns, element: <CompareRunsPage /> },
              { path: routePaths.admin.publish, element: <PublishPage /> },
              { path: routePaths.admin.auditLog, element: <AuditLogPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
])
