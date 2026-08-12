import { useQuery } from "@tanstack/react-query"
import { FileQuestion } from "lucide-react"
import { AllocationExplanation } from "@/components/allocation/allocation-explanation"
import { AllocationResultCard } from "@/components/allocation/allocation-result-card"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { explainAllocation, getMyAllocation } from "@/lib/services/allocation.service"

export function StudentAllocationPage() {
  const { session } = useAuth()
  const studentId = session!.ref_id!

  const allocationQuery = useQuery({
    queryKey: ["my-allocation", studentId],
    queryFn: () => getMyAllocation(studentId),
  })
  const explanationQuery = useQuery({
    queryKey: ["allocation-explanation", allocationQuery.data?.allocation_id],
    queryFn: () => explainAllocation(allocationQuery.data!.allocation_id),
    enabled: !!allocationQuery.data,
  })

  return (
    <div>
      <PageHeader title="My allocation" description="Your supervisor pairing, once published." />
      {allocationQuery.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : !allocationQuery.data ? (
        <EmptyState
          icon={FileQuestion}
          title="No allocation published yet"
          description="Your programme administrator hasn't published an allocation run. Check back later."
        />
      ) : (
        <div className="max-w-2xl space-y-4">
          <AllocationResultCard result={allocationQuery.data} perspective="student" />
          {explanationQuery.data && <AllocationExplanation explanation={explanationQuery.data} />}
        </div>
      )}
    </div>
  )
}
