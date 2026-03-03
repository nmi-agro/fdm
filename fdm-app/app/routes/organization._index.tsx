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
import { Empty, EmptyContent, EmptyHeader } from "~/components/ui/empty"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { extractFormValuesFromRequest } from "~/lib/form"
import { parseOrganizationMetadata } from "~/lib/organization-helpers"
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
                    metadata: parseOrganizationMetadata(org),
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
                title="Mijn organisaties"
                description="Organisaties stellen je in staat om met anderen samen te werken. Je kunt organisaties aanmaken of lid worden om samen gegevens te beheren."
            />
            {organizations.length > 0 || invitations.length > 0 ? (
                <>
                    {organizations.length > 0 && (
                        <div className="grid gap-6 p-6 md:p-10 md:pt-0 lg:grid-cols-2 xl:grid-cols-3">
                            {organizations.map((organization) => (
                                <OrganizationCard
                                    key={organization.id}
                                    organization={organization}
                                />
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
                                        <CardTitle>
                                            Nieuwe organisatie
                                        </CardTitle>
                                        <CardDescription>
                                            Voeg een extra organisatie toe aan
                                            uw account.
                                        </CardDescription>
                                    </CardHeader>
                                </NavLink>
                            </Card>
                        </div>
                    )}
                    {invitations.length > 0 && (
                        <>
                            {organizations.length > 0 && (
                                <FarmTitle
                                    title="Openstaande uitnodigingen naar organisaties"
                                    description="Je hebt uitnodigingen ontvangen voor toegang tot de volgende organisaties."
                                />
                            )}
                            <div className="grid gap-6 p-6 md:p-10 md:pt-0 lg:grid-cols-2 xl:grid-cols-3">
                                {invitations.map((invitation) => (
                                    <PendingOrganizationInvitationCard
                                        key={invitation.id}
                                        invitation={invitation}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </>
            ) : (
                <div className="mx-auto flex items-center flex-col justify-center space-y-6 sm:w-87.5">
                    <Empty>
                        <EmptyHeader>
                            Het lijkt erop dat je nog geen organisatie hebt.
                        </EmptyHeader>
                        <EmptyContent>
                            <Button asChild>
                                <NavLink to="/organization/new">
                                    Maak een organisatie
                                </NavLink>
                            </Button>
                            <p className="text-center text-sm text-muted-foreground">
                                of kunt u organisaties vragen om u uit te
                                nodigen.
                            </p>
                        </EmptyContent>
                    </Empty>
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
