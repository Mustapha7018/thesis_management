import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-context"
import { homeForRole } from "@/routes/route-paths"
import { isValidUniversityEmail } from "@/lib/utils/validation"

const schema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .refine(isValidUniversityEmail, {
      message: "Use a Sunderland account: students @student.sunderland.ac.uk, staff firstname.lastname@sunderland.ac.uk.",
    }),
})

export function LoginForm({ prefillEmail }: { prefillEmail?: string }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: { email: prefillEmail ?? "" },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    setFormError(null)
    try {
      const session = await login(values.email)
      navigate(homeForRole(session.role), { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Login failed.")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>University email</FormLabel>
              <FormControl>
                <Input placeholder="ab1cd2@student.sunderland.ac.uk" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          Log in
        </Button>
      </form>
    </Form>
  )
}
