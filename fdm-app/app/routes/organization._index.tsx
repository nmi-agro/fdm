import { Plus } from "lucide-react"
import { NavLink, useLoaderData } from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { OrganizationCard } from "~/components/blocks/organization/organization-card"
import { PendingOrganizationInvitationCard } from "~/components/blocks/organization/pending-organization-invitation"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "~/components/ui/empty"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { extractFormValuesFromRequest } from "~/lib/form"
import { AccessFormSchema } from "../lib/schemas/access.schema"
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

        const invitations = await auth.api.listUserInvitations({
            headers: request.headers,
        })

        return { organizations, invitations }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function OrganizationsIndex() {
    const { organizations, invitations } = useLoaderData<typeof loader>()

    return (
        <main>
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
            {organizations.length === 0 ? (
                <Empty className="border-none">
                    <EmptyHeader>
                        <EmptyTitle>
                            Je bent nog geen lid van een organisatie
                        </EmptyTitle>
                        <EmptyDescription>
                            Vraag bij je contactpersoon om een uitnodiging of
                            maak zelf een organisatie aan.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button asChild>
                            <NavLink to={"/organization/new"}>
                                Maak een organisatie aan
                            </NavLink>
                        </Button>
                    </EmptyContent>
                </Empty>
            ) : (
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 p-6">
                    {organizations.map((org) => (
                        <OrganizationCard key={org.id} organization={org} />
                    ))}
                    <Card className="flex flex-col border-dashed transition-all hover:border-primary/50 hover:bg-muted/50">
                        <NavLink
                            to="/organization/new"
                            className="flex h-full flex-col"
                        >
                            <CardHeader className="grow items-center justify-center text-center">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                    <Plus className="h-6 w-6" />
                                </div>
                                <CardTitle>Nieuwe organisatie</CardTitle>
                                <CardDescription>
                                    Voeg een extra organisatie toe aan uw
                                    account.
                                </CardDescription>
                            </CardHeader>
                        </NavLink>
                    </Card>
                </div>
            )}
            {invitations.length > 0 && (
                <div className="w-full p-6 space-y-4">
                    <h2 className="text-xl font-semibold">
                        Openstaande uitnodigingen
                    </h2>
                    <div className="grid w-full gap-4 sm:grid-cols-2">
                        {invitations.map((invitation) => (
                            <PendingOrganizationInvitationCard
                                key={invitation.id}
                                invitation={invitation}
                            />
                        ))}
                    </div>
                </div>
            )}
        </main>
    )
}

export async function action({ request }: Route.ActionArgs) {
    try {
        const formValues = await extractFormValuesFromRequest(
            request,
            AccessFormSchema,
        )

        // getSession call is important to validate session
        await getSession(request)

        if (formValues.intent === "accept_organization_invitation") {
            if (!formValues.invitation_id) {
                return dataWithError(null, "Ontbrekend uitnodigings id")
            }
            await auth.api.acceptInvitation({
                headers: request.headers,
                body: { invitationId: formValues.invitation_id },
            })
            return redirectWithSuccess("/organization", {
                message: "Uitnodiging geaccepteerd! 🎉",
            })
        }
        if (formValues.intent === "decline_organization_invitation") {
            if (!formValues.invitation_id) {
                return dataWithError(null, "Ontbrekend uitnodigings id")
            }
            await auth.api.rejectInvitation({
                headers: request.headers,
                body: { invitationId: formValues.invitation_id },
            })
            return redirectWithSuccess("/organization", {
                message: "Uitnodiging geweigerd.",
            })
        }
        throw new Error("invalid intent")
    } catch (error) {
        throw handleActionError(error)
    }
}
