import { useEffect } from "react"
import {
    type ActionFunctionArgs,
    data,
    Form,
    isRouteErrorResponse,
    type LoaderFunctionArgs,
    redirect,
    useLoaderData,
    useSearchParams,
    useSubmit,
} from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import z from "zod"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/organization.invitations.$invitation_id.respond"

// Meta
export const meta: Route.MetaFunction = () => {
    return [
        {
            title: `Uitnodiging - Organisatie | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk jouw uitnodiging.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    await getSession(request)

    // Check for valid invitation id
    const invitationId = params.invitation_id
    if (!invitationId) {
        throw data("Invitation not found", {
            status: 404,
            statusText: "Invitation not found",
        })
    }
    const invitation = await auth.api.getInvitation({
        query: {
            id: invitationId,
        },
        headers: request.headers,
    })

    if (!invitation) {
        throw data("Uitnodiging niet gevonden", {
            status: 404,
            statusText: "Invitation not found",
        })
    }

    return invitation
}

export default function Respond() {
    const invitation = useLoaderData<typeof loader>()

    const [searchParams] = useSearchParams()
    const intentRaw = searchParams.get("intent")
    const intent = intentRaw != null ? intentRaw.toLowerCase() : null

    const submit = useSubmit()

    useEffect(() => {
        if (intent && intent === "accept") {
            submit(
                {
                    intent: "accept",
                },
                { method: "POST" },
            )
        }
    }, [intent, submit])

    if (intent !== "accept" && intent !== "reject" && intent !== "do_nothing") {
        throw new Error(`Invalid intent: ${intent}`)
    }

    if (intent === "accept") {
        return (
            <h1 className="font-semibold mt-50 text-3xl text-center text-primary">
                Uitnodiging wordt geaccepteerd...
            </h1>
        )
    }

    return (
        <div className="max-w-3xl mx-auto my-4 px-4">
            <Card>
                <CardHeader>
                    <CardTitle>Uitnodiging afwijzen</CardTitle>
                </CardHeader>
                <CardContent>
                    <Separator />
                    <p className="my-1">
                        {`${invitation.inviterEmail} heeft je uitgenodigd om lid te worden van de organisatie `}
                        <span className="font-semibold">{`${invitation.organizationName}.`}</span>
                    </p>
                    <p className="my-1">
                        Je bent uitgenodigd als{" "}
                        <i className="font-semibold">
                            {{
                                owner: "Eigenaar",
                                admin: "Beheerder",
                                member: "Lid",
                            }[invitation.role] ?? "Lid"}
                        </i>
                    </p>
                    <p className="my-1">
                        Weet je zeker dat je deze uitnodiging wilt afwijzen?
                    </p>
                </CardContent>
                <CardFooter>
                    <Form method="post" className="flex flex-row gap-2">
                        <input
                            type="hidden"
                            name="invitation_id"
                            value={invitation.id}
                        />
                        <Button
                            variant="destructive"
                            name="intent"
                            value="reject"
                        >
                            Ja, afwijzen
                        </Button>
                        <Button
                            variant="secondary"
                            name="intent"
                            value="do_nothing"
                        >
                            Nee, terug naar Mijn Uitnodigingen
                        </Button>
                    </Form>
                </CardFooter>
            </Card>
        </div>
    )
}

const FormSchema = z.object({
    intent: z.enum(["accept", "reject", "do_nothing"]),
})

export async function action({ request, params }: ActionFunctionArgs) {
    const formValues = await extractFormValuesFromRequest(request, FormSchema)

    await getSession(request)

    const invitationId = params.invitation_id
    if (!invitationId) {
        throw data("Invitation not found", {
            status: 404,
            statusText: "Invitation not found",
        })
    }
    const invitation = await auth.api.getInvitation({
        query: {
            id: invitationId,
        },
        headers: request.headers,
    })

    if (!invitation) {
        throw dataWithError("Invitation not found", {
            message: "Uitnodiging niet gevonden",
        })
    }

    if (formValues.intent === "accept") {
        try {
            await auth.api.acceptInvitation({
                headers: request.headers,
                body: { invitationId: invitationId },
            })
        } catch (error) {
            console.error("Failed to accept invitation:", error)
            throw data("Failed to accept invitation", { status: 400 })
        }

        const organization = await auth.api.getFullOrganization({
            query: {
                organizationId: invitation.organizationId,
            },
            headers: request.headers,
        })
        if (!organization) {
            throw data("Organization not found", 404)
        }
        const organizationSlug = organization.slug

        return redirectWithSuccess(`/organization/${organizationSlug}`, {
            message: "Uitnodiging geaccepteerd! 🎉",
        })
    }

    if (formValues.intent === "reject") {
        try {
            await auth.api.rejectInvitation({
                headers: request.headers,
                body: { invitationId: invitationId },
            })
        } catch (_) {
            throw data("Invitation not found", 404)
        }
        return redirectWithSuccess("/organization", {
            message: "Uitnodiging afgewezen",
        })
    }

    if (formValues.intent === "do_nothing") {
        return redirect("/organization/invitations")
    }

    throw new Error("invalid intent")
}

export function ErrorBoundary(props: Route.ErrorBoundaryProps) {
    const error = props.error
    if (isRouteErrorResponse(error)) {
        if (error.status === 404) {
            return (
                <div className="max-w-3xl mx-auto my-4 px-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Uitnodiging niet beschikbaar</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Separator />
                            <p className="my-1">
                                Helaas, deze uitnodiging is niet langer geldig
                                of bestaat niet. Neem eventueel contact op met
                                degene die je heeft uitgenodigd voor een nieuwe
                                uitnodiging.
                            </p>
                        </CardContent>
                        <CardFooter>
                            <form method="post" className="flex flex-row gap-2">
                                <input
                                    type="hidden"
                                    name="invitation_id"
                                    value={props.params.invitation_id}
                                />
                                <Button
                                    variant="secondary"
                                    name="intent"
                                    value="do_nothing"
                                >
                                    Terug naar mijn uitnodigingen
                                </Button>
                            </form>
                        </CardFooter>
                    </Card>
                </div>
            )
        }
    }

    throw error
}
