import * as Sentry from "@sentry/react-router"
import { Asterisk, Dot, LifeBuoy, Send } from "lucide-react"
import { useEffect, useState } from "react"
import { NavLink, useParams } from "react-router"
import { toast } from "sonner"
import { clientConfig } from "@/app/lib/config"
import { modifySearchParams } from "@/app/lib/url-utils"
import { ChangelogNotification } from "~/components/custom/changelog-notification"
import { Badge } from "~/components/ui/badge"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "~/components/ui/sidebar"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip"

export function SidebarSupport({
    name,
    email,
    numNotViewed,
    numUnassigned,
}: {
    name: string | undefined
    email: string | undefined
    numNotViewed?: number
    numUnassigned?: number
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

    const [feedback, setFeedback] = useState<ReturnType<
        typeof Sentry.getFeedback
    > | null>(null)
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
            console.error(
                "Feedback object not available or missing createForm method.",
            )
            toast.error(
                "Feedback formulier is nog niet beschikbaar. Probeer het opnieuw.",
            )
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
                                to={modifySearchParams(
                                    "/support/new",
                                    (searchParams) => {
                                        if (params.b_id_farm) {
                                            searchParams.set(
                                                "context_farm_id",
                                                params.b_id_farm,
                                            )
                                        }
                                    },
                                )}
                            >
                                <LifeBuoy />
                                <span className="me-auto">Ondersteuning</span>
                                {typeof numUnassigned === "number" &&
                                    numUnassigned > 0 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge
                                                    variant="default"
                                                    className="p-0 ps-1 pe-2 h-6 bg-orange-400 hover:bg-orange-400 color-white"
                                                >
                                                    <Asterisk
                                                        className="m-0 size-4"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="sr-only">
                                                        {numUnassigned === 1
                                                            ? "1 ticket toe te wijzen"
                                                            : `${numUnassigned} tickets toe te wijzen`}
                                                    </span>
                                                    <span aria-hidden="true">
                                                        {numUnassigned}
                                                    </span>
                                                </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {numUnassigned === 1
                                                    ? "Er is een nieuw ticket toe te wijzen."
                                                    : `Er zijn ${numUnassigned} nieuwe tickets toe te wijzen.`}
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                {typeof numNotViewed === "number" &&
                                    numNotViewed > 0 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge
                                                    variant="default"
                                                    className="p-0 ps-1 pe-2 h-6 bg-blue-600 hover:bg-blue-600"
                                                >
                                                    <Dot
                                                        className="m-0 size-4 scale-200"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="sr-only">
                                                        {numNotViewed === 1
                                                            ? "1 nieuw bericht te bekijken"
                                                            : `${numNotViewed} nieuwe berichten te bekijken`}
                                                    </span>
                                                    <span aria-hidden="true">
                                                        {numNotViewed}
                                                    </span>
                                                </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {numNotViewed === 1
                                                    ? "U hebt een nieuw bericht te bekijken."
                                                    : `U hebt ${numNotViewed} nieuwe berichten te bekijken.`}
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    {clientConfig.analytics.sentry ? (
                        <SidebarMenuItem key="feedback">
                            <SidebarMenuButton
                                size="sm"
                                onClick={openFeedbackForm}
                            >
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
