import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { AllocationExplanation } from "@/components/allocation/allocation-explanation"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/context/auth-context"
import { explainAllocation, getSupervisorAllocations } from "@/lib/services/allocation.service"

export function SupervisorAllocationPage() {
  const { session } = useAuth()
  const supervisorId = session!.ref_id!
  const [openAllocationId, setOpenAllocationId] = useState<number | null>(null)

  const allocationsQuery = useQuery({
    queryKey: ["supervisor-allocations", supervisorId],
    queryFn: () => getSupervisorAllocations(supervisorId, { limit: 100 }),
  })
  const explanationQuery = useQuery({
    queryKey: ["allocation-explanation", openAllocationId],
    queryFn: () => explainAllocation(openAllocationId!),
    enabled: openAllocationId !== null,
  })

  return (
    <div>
      <PageHeader title="Allocated students" description="Your students from the published allocation run." />
      {allocationsQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !allocationsQuery.data || allocationsQuery.data.total === 0 ? (
        <EmptyState title="No allocation published yet" description="No students have been allocated to you yet." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Objective score</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocationsQuery.data.data.map((a) => (
                <TableRow key={a.allocation_id}>
                  <TableCell className="font-medium">{a.student_name}</TableCell>
                  <TableCell>{a.objective_score?.toFixed(2) ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setOpenAllocationId(a.allocation_id)}>
                      Why this pairing?
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={openAllocationId !== null} onOpenChange={(open) => !open && setOpenAllocationId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocation explanation</DialogTitle>
          </DialogHeader>
          {explanationQuery.data && <AllocationExplanation explanation={explanationQuery.data} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
