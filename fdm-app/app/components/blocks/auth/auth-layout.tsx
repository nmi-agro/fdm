import { Cookie } from "lucide-react"
import { Button } from "~/components/ui/button"

interface AuthLayoutProps {
  children: React.ReactNode
  backgroundImage?: string
  showCookieSettings?: boolean
}

export function AuthLayout({
  children,
  backgroundImage = "https://images.unsplash.com/photo-1662127245625-a72f1ad7e6ca?q=80&w=1974&auto=format&fit=crop",
  showCookieSettings = false,
}: AuthLayoutProps) {
  const openCookieSettings = () => {
    if (window?.openCookieSettings) {
      window.openCookieSettings()
    }
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-87.5 gap-6">{children}</div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src={backgroundImage}
          alt="Background"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
      {showCookieSettings && (
        <div className="fixed bottom-3 left-3 z-50">
          <Button
            variant="ghost"
            size="sm"
            className="bg-card/80 hover:bg-card border-border flex items-center gap-1 border text-xs opacity-70 hover:opacity-100"
            onClick={openCookieSettings}
          >
            <Cookie className="h-3 w-3" />
            <span>Cookie instellingen</span>
          </Button>
        </div>
      )}
    </div>
  )
}
