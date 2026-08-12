import { CampusSlideshow } from "@/components/auth/campus-slideshow"
import { LoginForm } from "@/components/auth/login-form"
import { SunderlandMark } from "@/components/brand/sunderland-mark"

export function LoginPage() {
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
            <p className="text-sm text-muted-foreground">Sign in with your university email and password.</p>
          </div>
          <div className="mt-4">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}
