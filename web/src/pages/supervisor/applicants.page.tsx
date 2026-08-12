import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ApplicantsScoringTable } from "@/components/profile/applicants-scoring-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { listApplicants, scoreApplicant } from "@/lib/services/profile.service"

export function ApplicantsPage() {
  const { session } = useAuth()
  const supervisorId = session!.ref_id!
  const queryClient = useQueryClient()

  const applicantsQuery = useQuery({
    queryKey: ["applicants", supervisorId],
    queryFn: () => listApplicants(supervisorId),
  })

  return (
    <div>
      <PageHeader
        title="Applicants"
        description="Students who ranked you as a preference. Score each applicant from 0 to 1."
      />
      {applicantsQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !applicantsQuery.data || applicantsQuery.data.length === 0 ? (
        <EmptyState title="No applicants yet" description="No students have listed you as a preference so far." />
      ) : (
        <ApplicantsScoringTable
          applicants={applicantsQuery.data}
          onScore={async (studentId, score) => {
            await scoreApplicant(supervisorId, studentId, score)
            await queryClient.invalidateQueries({ queryKey: ["applicants", supervisorId] })
          }}
        />
      )}
    </div>
  )
}
