import type { Invitation, Member, Organization } from "better-auth/plugins"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { z } from "zod"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { auth, getSession } from "~/lib/auth.server"
import {
    isInactiveRecipientError,
    renderInvitationEmail,
    sendEmail,
} from "~/lib/email.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { extractFormValuesFromRequest } from "~/lib/form"

export async function loader({ request, params }: LoaderFunctionArgs) {
    if (!params.slug) {
        throw handleLoaderError("not found: organization")
    }

    const session = await getSession(request)
    const organizations = await auth.api.listOrganizations({
        headers: request.headers,
    })

    const organization = organizations.find((org) => org.slug === params.slug)

    if (!organization) {
        throw handleLoaderError("not found: organization")
    }

    // Get members of organization
    const membersListResponse = await auth.api.listMembers({
        headers: request.headers,
        query: {
            organizationId: organization.id,
        },
    })
    const members = membersListResponse.members

    // Determine permissions
    const currentUserMember = members.find((m) => m.userId === session.user.id)
    const role = currentUserMember?.role || "viewer"
    const permissions = {
        canEdit: role === "owner" || role === "admin",
        canDelete: role === "owner",
        canInvite: role === "owner" || role === "admin",
        canUpdateRoleUser: role === "owner" || role === "admin",
        canRemoveUser: role === "owner" || role === "admin",
    }

    // Get pending invitations of organization
    let invitations: Invitation[] = []
    if (permissions.canInvite) {
        const invitationsListResponse = await auth.api.listInvitations({
            headers: request.headers,
            query: {
                organizationId: organization.id,
            },
        })
        invitations = (
            Array.isArray(invitationsListResponse)
                ? invitationsListResponse
                : []
        ).filter((inv) => inv.status === "pending")
    }

    return {
        organization: {
            ...organization,
            permissions,
            description: organization.metadata?.description || "",
        },
        invitations: invitations,
        members: members,
    }
}

export default function OrganizationIndex() {
    const { organization, invitations, members } =
        useLoaderData<typeof loader>()
    const permissions = organization.permissions

    return (
        <main className="container">
            <div className="max-w-3xl mx-auto px-4">
                {/* Changed this div to a flex container with justify-between */}
                <div className="mb-8 flex items-center justify-between">
                    <FarmTitle
                        title={organization.name}
                        description={organization.description || ""}
                    />
                </div>
                <div className="grid lg:grid-cols-1 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Leden</CardTitle>
                            <CardDescription>
                                Zie wie er onderdeel uitmaakt van deze
                                organisatie.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Separator className="my-4" />
                            <div className="space-y-4">
                                <div className="text-sm font-medium">
                                    {/* People with access */}
                                </div>
                                <div className="grid gap-6">
                                    {members.map((member) => (
                                        <MemberRow
                                            key={member.id}
                                            member={member}
                                            permissions={permissions}
                                        />
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    {permissions.canInvite ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Uitnodigingen</CardTitle>
                                <CardDescription>
                                    Nodig nieuwe leden uit en zie welke
                                    uitnodigingen nog open staan.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <InvitationForm
                                    organizationId={organization.id}
                                />
                                <Separator className="my-4" />
                                <div className="space-y-4">
                                    <div className="text-sm font-medium">
                                        Openstaande uitnodigingen:
                                    </div>
                                    {invitations.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">
                                            <p className="text-sm text-center text-muted-foreground">
                                                Er zijn op dit moment geen
                                                openstaande uitnodigingen.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-6">
                                            {invitations.map((invitation) => (
                                                <InvitationRow
                                                    key={invitation.id}
                                                    invitation={invitation}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </div>
        </main>
    )
}

type MemberWithUser = Member & {
    user: {
        id: string
        name: string
        email: string
        image?: string | null
    }
}

const MemberRow = ({
    member,
    permissions,
}: {
    member: MemberWithUser
    permissions: {
        canEdit: boolean
        canDelete: boolean
        canInvite: boolean
        canUpdateRoleUser: boolean
        canRemoveUser: boolean
    }
}) => {
    const initials = (member.user.name || "?").charAt(0).toUpperCase()
    return (
        <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-4">
                <Avatar>
                    <AvatarImage src={member.user.image ?? undefined} />
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-medium leading-none">
                        {member.user.name}
                    </p>
                    {!permissions.canUpdateRoleUser ? (
                        <p className="text-sm text-muted-foreground">
                            {member.role}
                        </p>
                    ) : null}
                </div>
            </div>
            {permissions.canUpdateRoleUser ? (
                <MemberAction member={member} permissions={permissions} />
            ) : null}
        </div>
    )
}

const MemberAction = ({
    member,
    permissions,
}: {
    member: MemberWithUser
    permissions: {
        canEdit: boolean
        canDelete: boolean
        canInvite: boolean
        canUpdateRoleUser: boolean
        canRemoveUser: boolean
    }
}) => {
    return (
        <form method="post" className="flex items-center space-x-4">
            <input type="hidden" name="memberId" value={member.id} />
            <Select defaultValue={member.role} name="role">
                <SelectTrigger className="ml-auto w-27.5">
                    <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="owner">Eigenaar</SelectItem>
                    <SelectItem value="admin">Beheerder</SelectItem>
                    <SelectItem value="member">Lid</SelectItem>
                </SelectContent>
            </Select>
            {permissions.canRemoveUser ? (
                <Button
                    variant="destructive"
                    className="shrink-0"
                    name="intent"
                    value="remove_user"
                >
                    Verwijder
                </Button>
            ) : null}
            <Button
                type="submit"
                className="shrink-0"
                name="intent"
                value="update_role"
            >
                Bijwerken
            </Button>
        </form>
    )
}

const InvitationRow = ({ invitation }: { invitation: Invitation }) => {
    return (
        <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-4">
                <Avatar>
                    <AvatarFallback>
                        {(invitation.email || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-medium leading-none">
                        {invitation.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {invitation.role}
                    </p>
                </div>
            </div>
            <div>
                <p className="text-sm font-medium leading-none">
                    Verloopt{" "}
                    {formatDistanceToNow(new Date(invitation.expiresAt), {
                        addSuffix: true,
                        locale: nl,
                    })}
                </p>
            </div>
            <form method="post">
                <input
                    type="hidden"
                    name="invitation_id"
                    value={invitation.id}
                />
                <input type="hidden" name="email" value={invitation.email} />
                <Button
                    variant="destructive"
                    className="shrink-0"
                    name="intent"
                    value="cancel_invite"
                >
                    Annuleer
                </Button>
            </form>
        </div>
    )
}

const InvitationForm = ({
    organizationId,
}: {
    organizationId: Organization["id"]
}) => {
    return (
        <form method="post" className="flex space-x-2">
            <input
                type="hidden"
                name="organization_id"
                value={organizationId}
            />
            <Input
                type="email"
                placeholder="Vul een emailadres in"
                name="email"
            />
            <Select defaultValue="member" name="role">
                <SelectTrigger className="ml-auto w-27.5">
                    <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="owner">Eigenaar</SelectItem>
                    <SelectItem value="admin">Beheerder</SelectItem>
                    <SelectItem value="member">Lid</SelectItem>
                </SelectContent>
            </Select>
            <Button
                variant="default"
                className="shrink-0"
                name="intent"
                value="invite_user"
            >
                Uitnodigen
            </Button>
        </form>
    )
}

const FormSchema = z.object({
    email: z.email().optional(),
    role: z.enum(["owner", "admin", "member"]).optional(),
    memberId: z.string().optional(),
    invitation_id: z.string().optional(),
    organization_id: z.string().optional(),
    intent: z.enum([
        "invite_user",
        "update_role",
        "remove_user",
        "cancel_invite",
    ]),
})

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        if (!params.slug) {
            throw handleActionError("not found: organization")
        }

        const formValues = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )
        const session = await getSession(request)

        const organizations = await auth.api.listOrganizations({
            headers: request.headers,
        })
        const organization = organizations.find(
            (org) => org.slug === params.slug,
        )
        if (!organization) {
            throw handleActionError("not found: organization")
        }
        const organizationId = organization.id
        const organizationName = organization.name

        if (formValues.intent === "invite_user") {
            if (!formValues.email) {
                return dataWithError(
                    null,
                    "Vul een e-mailadres in om iemand uit te nodigen",
                )
            }
            if (!formValues.role) {
                return handleActionError("missing: role")
            }

            const invitation = await auth.api.createInvitation({
                headers: request.headers,
                body: {
                    email: formValues.email,
                    role: formValues.role,
                    organizationId: organizationId,
                },
            })

            // better-auth might not send email by default depending on config.
            // We'll send it manually using our template.
            if (invitation?.id) {
                const invitationEmail = await renderInvitationEmail(
                    formValues.email,
                    session.user,
                    organizationName,
                    invitation.id,
                )
                try {
                    await sendEmail(invitationEmail)
                } catch (e) {
                    handleActionError(e)
                    await auth.api.cancelInvitation({
                        headers: request.headers,
                        body: {
                            invitationId: invitation.id,
                        },
                    })
                    if (isInactiveRecipientError(e)) {
                        return dataWithError(null, {
                            message: `We kunnen geen e-mails naar ${formValues.email} sturen omdat het als inactief is gemarkeerd. Neem contact op met de ondersteuning voor hulp.`,
                        })
                    }
                    return dataWithError(null, {
                        message: `We kunnen geen e-mails naar ${formValues.email} sturen. Neem contact op met de ondersteuning voor hulp.`,
                    })
                }
            }
            return dataWithSuccess(null, {
                message: `Gebruiker ${formValues.email} is uitgenodigd! 🎉`,
            })
        }
        if (formValues.intent === "update_role") {
            if (!formValues.memberId) {
                return handleActionError("missing: memberId")
            }
            if (!formValues.role) {
                return handleActionError("missing: role")
            }

            await auth.api.updateMemberRole({
                headers: request.headers,
                body: {
                    memberId: formValues.memberId,
                    role: formValues.role,
                    organizationId: organizationId,
                },
            })
            return dataWithSuccess(null, {
                message: "Rol is bijgewerkt! 🎉",
            })
        }
        if (formValues.intent === "remove_user") {
            if (!formValues.memberId) {
                return handleActionError("missing: memberId")
            }
            await auth.api.removeMember({
                headers: request.headers,
                body: {
                    memberIdOrEmail: formValues.memberId,
                    organizationId: organizationId,
                },
            })
            return dataWithSuccess(null, {
                message: "Gebruiker is verwijderd",
            })
        }
        if (formValues.intent === "cancel_invite") {
            if (!formValues.invitation_id)
                throw new Error("invalid invitation_id")
            await auth.api.cancelInvitation({
                headers: request.headers,
                body: {
                    invitationId: formValues.invitation_id,
                },
            })
            return dataWithSuccess(null, {
                message: `Uitnodiging voor ${formValues.email} is ingetrokken`,
            })
        }
        throw new Error("invalid intent")
    } catch (error) {
        throw handleActionError(error)
    }
}
