import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ResearchArea } from "@/lib/types/entities"

const schema = z.object({
  code: z.string().min(1, "Code is required.").regex(/^[A-Z0-9_]+$/, "Use uppercase letters, numbers and underscores."),
  name: z.string().min(1, "Name is required."),
  description: z.string().optional(),
})

export function ResearchAreaManager({
  areas,
  onCreate,
}: {
  areas: ResearchArea[]
  onCreate: (input: { code: string; name: string; description?: string }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", name: "", description: "" },
  })

  async function handleSubmit(values: z.infer<typeof schema>) {
    try {
      await onCreate(values)
      form.reset()
      setOpen(false)
      toast.success("Research area added.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add area.")
    }
  }

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="size-4" />
            New research area
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New research area</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="ROBOTICS" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Robotics & Autonomous Systems" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                Add area
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 md:grid-cols-2">
        {areas.map((area) => (
          <Card key={area.area_id}>
            <CardHeader>
              <CardTitle className="text-base">{area.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="font-mono text-xs text-muted-foreground">{area.code}</p>
              {area.description && <p className="text-sm text-muted-foreground">{area.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
