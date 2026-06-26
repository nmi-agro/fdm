import * as Sentry from "@sentry/react-router"
import { LifeBuoy, Send } from "lucide-react"
import { useEffect, useState } from "react"
import { NavLink, useParams } from "react-router"
import { toast } from "sonner"
import { clientConfig } from "@/app/lib/config"
import { modifySearchParams } from "@/app/lib/url-utils"
import { ChangelogNotification } from "~/components/custom/changelog-notification"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"

export function SidebarSupport({
  name,
  email,
  hasNotification,
}: {
  name: string | undefined
  email: string | undefined
  hasNotification?: boolean
}) {
  const params = useParams()

  useEffect(() => {
    if (clientConfig.analytics.sentry) {
      try {
        Sentry.setUser({
          fullName: name,
          email: email,
        })
      } catch (error) {
        Sentry.captureException(error)
      }
    }
  }, [name, email])

  const [feedback, setFeedback] = useState<ReturnType<typeof Sentry.getFeedback> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const feedbackInstance = Sentry.getFeedback()
      if (feedbackInstance) {
        setFeedback(feedbackInstance)
      } else {
        console.warn("Sentry.getFeedback() returned null or undefined.")
      }
    } catch (error) {
      console.error("Failed to initialize Sentry feedback:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  if (isLoading) {
    return null
  }

  const openFeedbackForm = async () => {
    if (!feedback || typeof feedback.createForm !== "function") {
      console.error("Feedback object not available or missing createForm method.")
      toast.error("Feedback formulier is nog niet beschikbaar. Probeer het opnieuw.")
      return
    }
    try {
      const form = await feedback.createForm()
      form.appendToDom()
      form.open()
    } catch (error) {
      Sentry.captureException(error)
      toast.error(
        "Er is een fout opgetreden bij het openen van het feedbackformulier. Probeer het later opnieuw.",
      )
    }
  }

  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupContent>
        <SidebarMenu>
          <ChangelogNotification />
          <SidebarMenuItem key="support">
            <SidebarMenuButton size="sm" asChild>
              <NavLink
                to={modifySearchParams("/support/new", (searchParams) => {
                  if (params.b_id_farm) {
                    searchParams.set("context_farm_id", params.b_id_farm)
                  }
                })}
              >
                <LifeBuoy />
                {hasNotification ? (
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="relative">
                        Ondersteuning
                        <span className="sr-only">, Er zijn nieuwe berichten te bekijken.</span>
                        <div className="bg-destructive absolute -top-1 -right-2 size-2 rounded-full" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Er zijn nieuwe berichten te bekijken.</TooltipContent>
                  </Tooltip>
                ) : (
                  <span>Ondersteuning</span>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {clientConfig.analytics.sentry ? (
            <SidebarMenuItem key="feedback">
              <SidebarMenuButton size="sm" onClick={openFeedbackForm}>
                <Send />
                <span>Feedback</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
