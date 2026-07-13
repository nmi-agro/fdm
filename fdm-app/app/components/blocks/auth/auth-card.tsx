import { NavLink } from "react-router"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { clientConfig } from "~/lib/config"
import { cn } from "~/lib/utils"

interface AuthCardProps {
  title: string
  description: string
  children: React.ReactNode
  backLink?: string
  backLabel?: string
  showLogo?: boolean
  contentClassName?: string
  /**
   * Overrides the default "back to sign in" footer. Pass `null` to omit the
   * footer entirely, or a node to render custom footer content instead.
   */
  footer?: React.ReactNode | null
}

export function AuthCard({
  title,
  description,
  children,
  backLink = "/signin",
  backLabel = "Terug naar aanmelden",
  showLogo = true,
  contentClassName,
  footer,
}: AuthCardProps) {
  return (
    <Card className="shadow-xl">
      <CardHeader className="text-center">
        {showLogo && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex aspect-square size-16 items-center justify-center rounded-lg bg-[#122023]">
                <img className="size-12" src={clientConfig.logomark} alt={clientConfig.name} />
              </div>
            </div>
            <h2 className="text-muted-foreground mb-2 text-lg font-semibold tracking-tight">
              {clientConfig.name}
            </h2>
          </>
        )}
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-4", contentClassName)}>{children}</CardContent>
      {footer !== null && (
        <CardFooter className="flex justify-center">
          {footer !== undefined ? (
            footer
          ) : (
            <Button asChild variant="ghost" className="text-muted-foreground w-full">
              <NavLink to={backLink}>{backLabel}</NavLink>
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
