import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const schema = z.object({
  scheduled_at: z.string().min(1, "Date and time are required."),
})

export function MeetingForm({
  onSubmit,
  trigger,
}: {
  onSubmit: (scheduledAt: string) => Promise<void>
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { scheduled_at: "" } })

  async function handleSubmit(values: z.infer<typeof schema>) {
    try {
      await onSubmit(new Date(values.scheduled_at).toISOString())
      form.reset()
      setOpen(false)
      toast.success("Meeting scheduled.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule meeting.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a meeting</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date and time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              Schedule
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
