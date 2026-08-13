import { useQueryClient } from "@tanstack/react-query"
import { CohortImportPanel } from "@/components/admin/cohort-import-panel"
import { ImportFormatDialog } from "@/components/admin/import-format-dialog"
import { PageHeader } from "@/components/common/page-header"

export function CohortImportPage() {
  const queryClient = useQueryClient()

  return (
    <div className="space-y-4">
      <PageHeader title="Import cohort" actions={<ImportFormatDialog />} />
      <CohortImportPanel onImported={() => void queryClient.invalidateQueries()} />
    </div>
  )
}
