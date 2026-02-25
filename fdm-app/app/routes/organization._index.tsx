import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import { Form, NavLink, useLoaderData } from "react-router-dom"
import { redirectWithSuccess } from "remix-toast"
import z from "zod"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { OrganizationCard } from "~/components/blocks/organization/organization-card"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { extractFormValuesFromRequest } from "../lib/form"
import type { Route } from "./+types/organization._index"

// Meta
export const meta: Route.MetaFunction = () => {
    return [
        {
            title: `Organisaties | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk de organisaties waarvan je lid bent.",
        },
    ]
}

export async function loader({ request }: Route.LoaderArgs) {
    try {
        const session = await getSession(request)

        const organizationsRaw = await auth.api.listOrganizations({
            headers: request.headers,
        })

        function parseMetadata(
            slug: string,
            rawMetadata: string | null | undefined,
        ) {
            try {
                return { data: rawMetadata ? JSON.parse(rawMetadata) : {} }
            } catch (e) {
                console.error(e)
                return {
                    error: `Failed to parse organization metadata for ${slug}`,
                }
            }
        }

        const organizations = await Promise.all(
            organizationsRaw.map(async (org) => {
                const members = await auth.api.listMembers({
                    headers: request.headers,
                    query: { organizationId: org.id },
                })
                const userRoles = members.members
                    .filter((member) => member.userId === session.principal_id)
                    .map((member) => member.role)
                const orderedUserRoles = (
                    ["owner", "admin", "member"] as const
                ).filter((r) => userRoles.includes(r))
                return {
                    ...org,
                    userRoles: orderedUserRoles,
                    metadata: parseMetadata(org.slug, org.metadata),
                }
            }),
        )

        const invitationsList = await auth.api.listUserInvitations({
            headers: request.headers,
        })

        const invitations = await Promise.all(
            invitationsList
                .filter((invitation) => invitation.status === "pending")
                .map(async (invitation) => {
                    return await auth.api.getInvitation({
                        query: {
                            id: invitation.id,
                        },
                        headers: request.headers,
                    })
                }),
        )

        return { organizations, invitations }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function OrganizationsIndex() {
    const { organizations, invitations } = useLoaderData<typeof loader>()

    return (
        <main>
            {/* Changed this div to a flex container with justify-between */}
            <div className="flex items-center justify-between">
                <FarmTitle
                    title={"Mijn organisaties"}
                    description={
                        "Organisaties stellen je in staat om met anderen samen te werken. Je kunt organisaties aanmaken of lid worden om samen gegevens te beheren."
                    }
                    action={{
                        to: "/organization/new",
                        label: "Organisatie aanmaken",
                    }}
                />
            </div>
            <div className="flex flex-col xl:flex-row gap-12 p-6">
                <div className="xl:grow space-y-4">
                    <div className="text-2xl font-semibold tracking-tight invisible">
                        &nbsp;
                    </div>
                    {organizations.length === 0 ? (
                        <div className="mx-auto flex h-full w-full items-center flex-col justify-center space-y-6 sm:w-87.5">
                            <div className="flex flex-col space-y-2 text-center">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    Je bent nog geen lid van een organisatie
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Vraag bij je contactpersoon om een
                                    uitnodiging of maak zelf een organisatie
                                    aan.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                            {organizations.map((org) => (
                                <OrganizationCard
                                    key={org.id}
                                    organization={org}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold tracking-tight ps-4">
                        Mijn Uitnodigingen
                    </h2>
                    {invitations.length === 0 ? (
                        <div className="mx-auto flex h-full w-full items-center flex-col justify-center space-y-6 sm:w-87.5">
                            <div className="flex flex-col space-y-2 text-center">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    Je hebt op dit moment geen uitnodigingen
                                    open staan
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Vraag bij je contactpersoon om een
                                    uitnodiging als je bij een organisatie wil.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1">
                            {invitations.map((invitation) => (
                                <Card
                                    key={invitation.id}
                                    className="p-4 space-y-4"
                                >
                                    <CardHeader className="p-0">
                                        <CardTitle>
                                            {invitation.organizationName}
                                        </CardTitle>
                                        <CardDescription>
                                            Uitgenodigd door{" "}
                                            {invitation.inviterEmail}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <p className="leading-none">
                                            Je bent uitgenodigd als{" "}
                                            <i className="font-semibold">
                                                {
                                                    {
                                                        owner: "Eigenaar",
                                                        admin: "Beheerder",
                                                        member: "Lid",
                                                    }[invitation.role]
                                                }
                                            </i>
                                        </p>
                                        <br />
                                        <p className="text-sm text-muted-foreground mt-2">
                                            Verloopt{" "}
                                            {formatDistanceToNow(
                                                new Date(invitation.expiresAt),
                                                {
                                                    addSuffix: true,
                                                    locale: nl,
                                                },
                                            )}
                                        </p>
                                    </CardContent>
                                    <CardFooter className="flex justify-between p-0">
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                        >
                                            <NavLink
                                                to={`/organization/${invitation.organizationSlug}`}
                                            >
                                                Meer info
                                            </NavLink>
                                        </Button>
                                        <div className="flex gap-2">
                                            <Form method="post">
                                                <input
                                                    type="hidden"
                                                    name="invitation_id"
                                                    value={invitation.id}
                                                />
                                                <Button
                                                    name="intent"
                                                    value="accept"
                                                    size="sm"
                                                >
                                                    Accepteren
                                                </Button>
                                            </Form>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        Afwijzen
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>
                                                            Uitnodiging afwijzen
                                                        </DialogTitle>
                                                        <DialogDescription>
                                                            Weet je zeker dat je
                                                            de uitnodiging van{" "}
                                                            {
                                                                invitation.organizationName
                                                            }{" "}
                                                            wilt afwijzen?
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <DialogFooter>
                                                        <Form method="post">
                                                            <input
                                                                type="hidden"
                                                                name="invitation_id"
                                                                value={
                                                                    invitation.id
                                                                }
                                                            />
                                                            <Button
                                                                variant="default"
                                                                name="intent"
                                                                value="reject"
                                                                size="sm"
                                                            >
                                                                Ja, afwijzen
                                                            </Button>
                                                        </Form>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}

const FormSchema = z.object({
    invitation_id: z.string(),
    intent: z.enum(["accept", "reject"]),
})

export async function action({ request }: Route.LoaderArgs) {
    try {
        const formValues = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )

        // getSession call is important to validate session
        await getSession(request)

        if (formValues.intent === "accept") {
            await auth.api.acceptInvitation({
                headers: request.headers,
                body: { invitationId: formValues.invitation_id },
            })
            return redirectWithSuccess("/organization", {
                message: "Uitnodiging geaccepteerd! 🎉",
            })
        }
        if (formValues.intent === "reject") {
            await auth.api.rejectInvitation({
                headers: request.headers,
                body: { invitationId: formValues.invitation_id },
            })
            return redirectWithSuccess("/organization", {
                message: "Uitnodiging afgewezen",
            })
        }
        throw new Error("invalid intent")
    } catch (error) {
        throw handleActionError(error)
    }
}
