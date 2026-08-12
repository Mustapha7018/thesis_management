import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/common/page-header"
import { InterestsEditor } from "@/components/profile/interests-editor"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { getMyInterests, listResearchAreas, setMyInterests } from "@/lib/services/profile.service"

export function ProfileInterestsPage() {
  const { session } = useAuth()
  const studentId = session!.ref_id!
  const queryClient = useQueryClient()

  const areasQuery = useQuery({ queryKey: ["research-areas"], queryFn: listResearchAreas })
  const interestsQuery = useQuery({
    queryKey: ["student-interests", studentId],
    queryFn: () => getMyInterests(studentId),
  })

  if (areasQuery.isPending || interestsQuery.isPending) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div>
      <PageHeader
        title="Research interests"
        description="Rank 1–3 research areas you're interested in — this feeds your supervisor matching."
      />
      <InterestsEditor
        areas={areasQuery.data ?? []}
        initialAreaIds={(interestsQuery.data ?? []).map((i) => i.area_id)}
        onSave={async (interests) => {
          await setMyInterests(studentId, interests)
          await queryClient.invalidateQueries({ queryKey: ["student-interests", studentId] })
        }}
      />
    </div>
  )
}
