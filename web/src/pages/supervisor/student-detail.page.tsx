import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { PageHeader } from "@/components/common/page-header"
import { StudentDetailDrilldown } from "@/components/dashboard/student-detail-drilldown"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { clearFlag, getStudentDetail, listAtRiskFlags, markFlagReviewed } from "@/lib/services/dashboard.service"

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const id = Number(studentId)
  const { session } = useAuth()
  const queryClient = useQueryClient()

  const detailQuery = useQuery({ queryKey: ["student-detail", id], queryFn: () => getStudentDetail(id) })
  const flagsQuery = useQuery({
    queryKey: ["at-risk-flags", { studentId: id }],
    queryFn: () => listAtRiskFlags({ studentId: id }),
  })

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["at-risk-flags", { studentId: id }] })
    await queryClient.invalidateQueries({ queryKey: ["at-risk-flags", { supervisorId: session!.ref_id, active: true }] })
  }

  if (detailQuery.isPending || flagsQuery.isPending) return <Skeleton className="h-96 w-full" />
  if (!detailQuery.data) return null

  return (
    <div>
      <PageHeader
        title={detailQuery.data.student_name}
        description={`Supervised by ${detailQuery.data.supervisor_name}`}
        showBackButton
      />
      <StudentDetailDrilldown
        detail={detailQuery.data}
        flags={flagsQuery.data ?? []}
        onMarkReviewed={async (flagId) => {
          await markFlagReviewed(flagId)
          await invalidate()
        }}
        onClear={async (flagId, note) => {
          await clearFlag(flagId, note)
          await invalidate()
        }}
      />
    </div>
  )
}
