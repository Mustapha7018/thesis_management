import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/common/page-header"
import { ExpertiseEditor } from "@/components/profile/expertise-editor"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { getMyExpertise, listResearchAreas, setMyExpertise } from "@/lib/services/profile.service"

export function ExpertisePage() {
  const { session } = useAuth()
  const supervisorId = session!.ref_id!
  const queryClient = useQueryClient()

  const areasQuery = useQuery({ queryKey: ["research-areas"], queryFn: listResearchAreas })
  const expertiseQuery = useQuery({
    queryKey: ["supervisor-expertise", supervisorId],
    queryFn: () => getMyExpertise(supervisorId),
  })

  if (areasQuery.isPending || expertiseQuery.isPending) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div>
      <PageHeader
        title="Expertise"
        description="Maintain 2–4 research areas with your proficiency level — this feeds student matching."
      />
      <ExpertiseEditor
        areas={areasQuery.data ?? []}
        initial={(expertiseQuery.data ?? []).map((e) => ({ areaId: e.area_id, proficiency: e.proficiency }))}
        onSave={async (expertise) => {
          await setMyExpertise(
            supervisorId,
            expertise.map((e) => ({ areaId: e.areaId, proficiency: e.proficiency })),
          )
          await queryClient.invalidateQueries({ queryKey: ["supervisor-expertise", supervisorId] })
        }}
      />
    </div>
  )
}
