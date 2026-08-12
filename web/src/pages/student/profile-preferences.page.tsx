import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/common/page-header"
import { SupervisorPreferenceList } from "@/components/profile/supervisor-preference-list"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { getPreferenceWindow } from "@/lib/services/admin.service"
import { getMyPreferenceList, listSupervisorsBrief, setMyPreferenceList } from "@/lib/services/profile.service"

export function ProfilePreferencesPage() {
  const { session } = useAuth()
  const studentId = session!.ref_id!
  const queryClient = useQueryClient()

  const supervisorsQuery = useQuery({ queryKey: ["supervisors-brief"], queryFn: listSupervisorsBrief })
  const preferencesQuery = useQuery({
    queryKey: ["student-preferences", studentId],
    queryFn: () => getMyPreferenceList(studentId),
  })
  const windowQuery = useQuery({ queryKey: ["preference-window"], queryFn: getPreferenceWindow })

  if (supervisorsQuery.isPending || preferencesQuery.isPending || windowQuery.isPending) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div>
      <PageHeader
        title="Supervisor preferences"
        description="Rank exactly 5 distinct supervisors, most preferred first."
      />
      <SupervisorPreferenceList
        supervisors={supervisorsQuery.data ?? []}
        initialSupervisorIds={(preferencesQuery.data ?? []).map((p) => p.supervisor_id)}
        windowOpen={windowQuery.data?.is_open ?? false}
        onSave={async (ids) => {
          await setMyPreferenceList(studentId, ids)
          await queryClient.invalidateQueries({ queryKey: ["student-preferences", studentId] })
        }}
      />
    </div>
  )
}
