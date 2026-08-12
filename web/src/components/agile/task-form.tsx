import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TaskInput } from "@/lib/types/dto"
import type { Milestone, Sprint } from "@/lib/types/entities"

const schema = z.object({
  title: z.string().min(1, "Title is required."),
  priority: z.enum(["low", "medium", "high"]),
  sprint_id: z.string(),
  milestone_id: z.string(),
})

export function TaskForm({
  sprints,
  milestones,
  onSubmit,
  trigger,
}: {
  sprints: Sprint[]
  milestones: Milestone[]
  onSubmit: (input: TaskInput) => Promise<void>
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", priority: "medium", sprint_id: "none", milestone_id: "none" },
  })

  async function handleSubmit(values: z.infer<typeof schema>) {
    try {
      await onSubmit({
        title: values.title,
        priority: values.priority,
        sprint_id: values.sprint_id === "none" ? null : Number(values.sprint_id),
        milestone_id: values.milestone_id === "none" ? null : Number(values.milestone_id),
      })
      form.reset()
      setOpen(false)
      toast.success("Task added.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add task.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Write evaluation chapter draft" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="sprint_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sprint</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {sprints.map((s) => (
                          <SelectItem key={s.sprint_id} value={String(s.sprint_id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="milestone_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milestone</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {milestones.map((m) => (
                          <SelectItem key={m.milestone_id} value={String(m.milestone_id)}>
                            {m.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              Add task
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
