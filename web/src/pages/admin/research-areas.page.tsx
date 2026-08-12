import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ResearchAreaManager } from "@/components/admin/research-area-manager"
import { PageHeader } from "@/components/common/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { createResearchArea, listResearchAreas } from "@/lib/services/admin.service"

export function ResearchAreasPage() {
  const queryClient = useQueryClient()
  const areasQuery = useQuery({ queryKey: ["research-areas"], queryFn: listResearchAreas })

  return (
    <div>
      <PageHeader title="Research areas" description="The taxonomy shared by student interests and supervisor expertise." />
      {areasQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ResearchAreaManager
          areas={areasQuery.data ?? []}
          onCreate={async (input) => {
            await createResearchArea(input)
            await queryClient.invalidateQueries({ queryKey: ["research-areas"] })
          }}
        />
      )}
    </div>
  )
}
