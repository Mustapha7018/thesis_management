import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import type { RunBenchmark } from "@/lib/types/dto"

export function PublishDialog({ run, onPublish }: { run: RunBenchmark; onPublish: () => Promise<void> }) {
  if (run.published) {
    return (
      <Button size="sm" variant="outline" disabled>
        Published
      </Button>
    )
  }

  return (
    <ConfirmDialog
      trigger={<Button size="sm">Publish</Button>}
      title="Publish this run?"
      description={`This locks in "${run.label}" as the one pairing set every student and supervisor sees, and unpublishes any currently published run. This does not delete other runs — you can publish a different one later.`}
      confirmLabel="Publish"
      onConfirm={onPublish}
    />
  )
}
