import type { Role } from "@/lib/types/entities"

export const routePaths = {
  login: "/login",
  student: {
    home: "/student",
    interests: "/student/profile/interests",
    preferences: "/student/profile/preferences",
    allocation: "/student/allocation",
    agile: "/student/agile",
    sprints: "/student/agile/sprints",
    milestones: "/student/agile/milestones",
    meetings: "/student/meetings",
  },
  supervisor: {
    home: "/supervisor",
    expertise: "/supervisor/expertise",
    applicants: "/supervisor/applicants",
    allocation: "/supervisor/allocation",
    studentDetail: (studentId: number | string) => `/supervisor/students/${studentId}`,
    meetings: "/supervisor/meetings",
  },
  admin: {
    home: "/admin",
    users: "/admin/users",
    cohort: "/admin/cohort",
    supervisors: "/admin/supervisors",
    supervisorDetail: (supervisorId: number | string) => `/admin/supervisors/${supervisorId}`,
    researchAreas: "/admin/research-areas",
    preferenceWindow: "/admin/preference-window",
    runAllocation: "/admin/allocation/run",
    compareRuns: "/admin/allocation/compare",
    publish: "/admin/allocation/publish",
    auditLog: "/admin/audit-log",
  },
} as const

export function homeForRole(role: Role): string {
  switch (role) {
    case "student":
      return routePaths.student.home
    case "supervisor":
      return routePaths.supervisor.home
    case "admin":
      return routePaths.admin.home
  }
}
