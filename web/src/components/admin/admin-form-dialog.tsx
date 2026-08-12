import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { AdminUserRow } from "@/lib/types/dto"
import { isStaffEmail } from "@/lib/utils/validation"

const schema = z.object({
  displayName: z.string().min(1, "Name is required."),
  email: z.string().refine(isStaffEmail, "Use firstname.lastname@sunderland.ac.uk."),
})

export type AdminFormValues = z.infer<typeof schema>

export type AdminDialogState = { mode: "create" } | { mode: "edit"; user: AdminUserRow }

export function AdminFormDialog({
  state,
  onOpenChange,
  onSubmit,
}: {
  state: AdminDialogState | null
  onOpenChange: (open: boolean) => void
  onSubmit: (values: AdminFormValues) => Promise<void>
}) {
  const form = useForm<AdminFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "", email: "" },
  })

  useEffect(() => {
    if (!state) return
    form.reset(
      state.mode === "edit"
        ? { displayName: state.user.display_name, email: state.user.email }
        : { displayName: "", email: "" },
    )
  }, [state, form])

  async function handleSubmit(values: AdminFormValues) {
    try {
      await onSubmit(values)
      onOpenChange(false)
      toast.success(state?.mode === "edit" ? "Admin updated." : "Admin created.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save admin.")
    }
  }

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state?.mode === "edit" ? "Edit admin" : "New admin"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Sam Turner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="sam.turner@sunderland.ac.uk" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {state?.mode === "edit" ? "Save changes" : "Create admin"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
