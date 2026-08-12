import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { CampusSlideshow } from "@/components/auth/campus-slideshow"
import { DemoAccountPicker } from "@/components/auth/demo-account-picker"
import { LoginForm } from "@/components/auth/login-form"
import { SunderlandMark } from "@/components/brand/sunderland-mark"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export function LoginPage() {
  const [prefillEmail, setPrefillEmail] = useState<string | undefined>(undefined)
  const [showDemoAccounts, setShowDemoAccounts] = useState(false)

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="hidden lg:block">
        <CampusSlideshow />
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center bg-primary shadow-sm">
              <SunderlandMark className="h-7 w-auto text-primary-foreground" />
            </span>
            <div>
              <h1 className="text-3xl leading-tight font-bold">Thesis Portal</h1>
              <p className="text-sm text-muted-foreground">University of Sunderland</p>
            </div>
          </div>

          <div className="mb-1">
            <h2 className="text-base font-semibold">Log in</h2>
            <p className="text-sm text-muted-foreground">Sign in with your university email.</p>
          </div>
          <div className="mt-4">
            <LoginForm key={prefillEmail} prefillEmail={prefillEmail} />
          </div>

          <Separator className="my-6" />

          <button
            type="button"
            onClick={() => setShowDemoAccounts((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            This build runs on seeded demo data — browse demo accounts
            <ChevronDown className={cn("size-4 transition-transform", showDemoAccounts && "rotate-180")} />
          </button>
          {showDemoAccounts && (
            <div className="mt-4">
              <DemoAccountPicker onSelect={setPrefillEmail} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
