import {
    acceptInvitation,
    declineInvitation,
    getFarms,
    getFields,
    listPendingInvitationsForUser,
} from "@nmi-agro/fdm-core"
import { Square, Users } from "lucide-react"
import { data, NavLink, useLoaderData } from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { cn } from "@/app/lib/utils"
import {
    FarmCard,
    type FarmWithRoles,
} from "~/components/blocks/farm/farm-card"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { PendingInvitationCard } from "~/components/blocks/farm/pending-invitation"
import {
    Expandable,
    ExpandableContent,
    ExpandableTrigger,
} from "~/components/custom/expandable"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "~/components/ui/empty"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { SidebarInset } from "~/components/ui/sidebar"
import { auth, getSession } from "~/lib/auth.server"
import { getCalendarSelection } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { parseOrganizationMetadata } from "~/lib/organization-helpers"
import { AccessFormSchema } from "~/lib/schemas/access.schema"
import { useCalendarStore } from "~/store/calendar"
import type { Route } from "./+types/organization.$slug._index"

// Meta
export const meta: Route.MetaFunction = () => {
    return [
        {
            title: `Organisatie | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk en bewerk de gegevens van jouw organisatie.",
        },
    ]
}

export async function loader({ params, request }: Route.LoaderArgs) {
    try {
        const session = await getSession(request)
        const organizations = await auth.api.listOrganizations({
            headers: request.headers,
        })

        const rawOrganization = organizations.find(
            (org) => org.slug === params.slug,
        )

        if (!rawOrganization) {
            throw data("Organisatie niet gevonden.", {
                status: 404,
                statusText: "Organisatie niet gevonden.",
            })
        }

        const organization = {
            ...rawOrganization,
            metadata: parseOrganizationMetadata(rawOrganization),
        }

        const members = await auth.api.listMembers({
            headers: request.headers,
            query: { organizationSlug: params.slug },
        })

        const userRoles = new Set(
            members.members
                .filter((member) => member.userId === session.principal_id)
                .map((member) => member.role),
        )

        // TODO: Sync role permissions with fdm-core better
        const canModify = userRoles.has("owner") || userRoles.has("admin")

        // Get pending farm invitations for this organization
        const allPendingInvitations = await listPendingInvitationsForUser(
            fdm,
            session.principal_id,
        )
        const pendingInvitations = allPendingInvitations.filter(
            (invitation) => invitation.target_principal_id === organization.id,
        )

        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, organization.id)

        // Get latest available year
        const calendar = getCalendarSelection()[0] ?? "all"

        const farmsExtended: (FarmWithRoles & {
            b_area_farm: number | null
        })[] = await Promise.all(
            farms.map(async (farm) => {
                const fields = await getFields(
                    fdm,
                    session.principal_id,
                    farm.b_id_farm,
                )

                const farmArea = fields.reduce(
                    (acc, field) => acc + (field.b_area ?? 0),
                    0,
                )

                return {
                    ...farm,
                    roles: undefined,
                    b_area_farm: farmArea,
                    userRoles: [
                        ...new Set(farm.roles.map((role) => role.role)),
                    ],
                }
            }),
        )

        const totalArea = farmsExtended.reduce(
            (acc, farm) => acc + (farm.b_area_farm ?? 0),
            0,
        )

        return {
            farms: farmsExtended,
            totalArea: totalArea,
            calendar: calendar,
            slug: params.slug,
            organization: organization,
            members: members.members,
            pendingInvitations: pendingInvitations,
            canModify: canModify,
        }
    } catch (e) {
        throw handleLoaderError(e)
    }
}

/**
 * Renders the user interface for farm management.
 *
 * This component uses data from the loader to display a personalized greeting and either a list of available
 * farms for selection or a prompt to create a new farm if none exist. It integrates various UI elements like
 * the header, title, card layout, and navigation buttons to facilitate seamless interaction.
 */
export default function AppIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const calendar = useCalendarStore((store) => store.calendar)
    const setCalendar = useCalendarStore((store) => store.setCalendar)
    const years = getCalendarSelection()

    const description = loaderData.organization.metadata.data?.description
    return (
        <SidebarInset>
            <main>
                <FarmTitle
                    title={`Dashboard van ${loaderData.organization.name}`}
                    description={"Bekijk alle informatie over deze organisatie"}
                    action={{ label: "Terug naar organisaties", to: "./.." }}
                />
                <FarmContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Quick Actions */}
                            <div className="space-y-4">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    Overzichten
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <NavLink to={`${calendar}/farms`}>
                                        <Card className="transition-all hover:shadow-md">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-primary text-primary-foreground p-3">
                                                        <Square className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            Bedrijven
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Uitgebreide tabel
                                                            met bedrijven met
                                                            toegang tot deze
                                                            organisatie.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>
                                    <NavLink to="members">
                                        <Card className="transition-all hover:shadow-md">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-primary text-primary-foreground p-3">
                                                        <Users className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            Leden
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Bekijk en beheer de
                                                            gebruikers die
                                                            toegang hebben tot
                                                            deze organisatie.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    Bedrijven
                                </h2>
                                {loaderData.farms.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {loaderData.farms.map((farm) => (
                                            <FarmCard
                                                key={farm.b_id_farm}
                                                farm={farm}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    loaderData.pendingInvitations.length ===
                                        0 && (
                                        <Empty className="border-none">
                                            <EmptyHeader>
                                                <EmptyTitle>
                                                    Het lijkt erop dat je
                                                    organisatie geen toegang
                                                    heeft tot bedrijven. :(
                                                </EmptyTitle>
                                                <EmptyDescription>
                                                    Neem contact op met
                                                    bedrijven om toegang tot hen
                                                    te krijgen.
                                                </EmptyDescription>
                                            </EmptyHeader>
                                        </Empty>
                                    )
                                )}
                            </div>
                            {loaderData.pendingInvitations.length > 0 && (
                                <div className="w-full space-y-4">
                                    <h2 className="text-xl font-semibold">
                                        Openstaande uitnodigingen
                                    </h2>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {loaderData.pendingInvitations.map(
                                            (invitation) => (
                                                <PendingInvitationCard
                                                    key={
                                                        invitation.invitation_id
                                                    }
                                                    principalType="organization"
                                                    invitation={invitation}
                                                />
                                            ),
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column */}
                        <div className="space-y-8">
                            {/* Overview */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-semibold tracking-tight">
                                        Overzicht
                                    </h2>
                                    <Button asChild variant="outline">
                                        <NavLink
                                            to="./settings"
                                            className={cn(
                                                !loaderData.canModify &&
                                                    "invisible",
                                            )}
                                        >
                                            Instellingen
                                        </NavLink>
                                    </Button>
                                </div>
                                <Card>
                                    <CardContent className="pt-6 space-y-4">
                                        {/* tiles */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                                                <p className="text-xs text-muted-foreground">
                                                    Bedrijven
                                                </p>
                                                <p className="text-2xl font-bold">
                                                    {loaderData.farms.length}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                                                <p className="text-xs text-muted-foreground">
                                                    Oppervlakte
                                                </p>
                                                <p className="text-2xl font-bold">
                                                    {Math.round(
                                                        loaderData.totalArea *
                                                            10,
                                                    ) / 10}
                                                    <span className="text-sm font-normal text-muted-foreground ml-1">
                                                        ha
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                        <Separator />
                                        {/* Year selector */}
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-muted-foreground">
                                                Jaar
                                            </p>
                                            <Select
                                                value={calendar}
                                                onValueChange={(value) =>
                                                    setCalendar(value)
                                                }
                                            >
                                                <SelectTrigger className="w-40">
                                                    <SelectValue placeholder="Selecteer een jaar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {years.map((year) => (
                                                        <SelectItem
                                                            key={year}
                                                            value={year}
                                                        >
                                                            {year}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Separator />
                                        {/* Description */}
                                        <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground">
                                                Beschrijving
                                            </p>
                                            <Expandable>
                                                <ExpandableContent className="whitespace-pre-line text-sm">
                                                    {description &&
                                                    description.length > 0
                                                        ? description
                                                        : "Geen beschrijving"}
                                                </ExpandableContent>
                                                <ExpandableTrigger />
                                            </Expandable>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Settings */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-semibold tracking-tight">
                                        Leden
                                    </h2>
                                    <Button asChild variant="outline">
                                        <NavLink
                                            to="./members"
                                            className={cn(
                                                !loaderData.canModify &&
                                                    "invisible",
                                            )}
                                        >
                                            Beheer
                                        </NavLink>
                                    </Button>
                                </div>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="space-y-1">
                                            <div className="grid gap-6">
                                                {loaderData.members.map(
                                                    (member) => {
                                                        const initials = (
                                                            member.user.name ||
                                                            "?"
                                                        )
                                                            .charAt(0)
                                                            .toUpperCase()
                                                        return (
                                                            <div
                                                                key={member.id}
                                                                className="flex items-center space-x-4"
                                                            >
                                                                <Avatar>
                                                                    <AvatarImage
                                                                        src={
                                                                            member
                                                                                .user
                                                                                .image ??
                                                                            undefined
                                                                        }
                                                                    />
                                                                    <AvatarFallback>
                                                                        {
                                                                            initials
                                                                        }
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="text-sm font-medium leading-none">
                                                                        {
                                                                            member
                                                                                .user
                                                                                .name
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )
                                                    },
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </FarmContent>
            </main>
        </SidebarInset>
    )
}

export async function action({ request }: Route.ActionArgs) {
    try {
        const session = await getSession(request)
        const formValues = await extractFormValuesFromRequest(
            request,
            AccessFormSchema,
        )

        if (formValues.intent === "accept_farm_invitation") {
            if (!formValues.invitation_id) {
                return dataWithError(null, "Ontbrekend uitnodigings id")
            }
            await acceptInvitation(
                fdm,
                formValues.invitation_id,
                session.user.id,
            )
            return dataWithSuccess(null, {
                message: "Uitnodiging geaccepteerd! 🎉",
            })
        }

        if (formValues.intent === "decline_farm_invitation") {
            if (!formValues.invitation_id) {
                return dataWithError(null, "Ontbrekend uitnodigings id")
            }
            await declineInvitation(
                fdm,
                formValues.invitation_id,
                session.user.id,
            )
            return dataWithSuccess(null, {
                message: "Uitnodiging geweigerd.",
            })
        }

        return dataWithError(null, "Onbekende actie")
    } catch (error) {
        handleActionError(error)
        return dataWithError(null, "Er is iets misgegaan")
    }
}
