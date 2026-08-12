import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PreferenceWindowToggle } from "@/components/admin/preference-window-toggle"
import { PageHeader } from "@/components/common/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { getPreferenceWindow, setPreferenceWindow } from "@/lib/services/admin.service"

export function PreferenceWindowPage() {
  const queryClient = useQueryClient()
  const windowQuery = useQuery({ queryKey: ["preference-window"], queryFn: getPreferenceWindow })

  return (
    <div>
      <PageHeader
        title="Preference window"
        description="Control when students can submit or change their supervisor preference list."
      />
      {windowQuery.isPending ? (
        <Skeleton className="h-64 w-full max-w-md" />
      ) : (
        <PreferenceWindowToggle
          window={windowQuery.data!}
          onSave={async (patch) => {
            await setPreferenceWindow(patch)
            await queryClient.invalidateQueries({ queryKey: ["preference-window"] })
          }}
        />
      )}
    </div>
  )
}
