import {
    acceptInvitation,
    declineInvitation,
    getFarms,
    listPendingInvitationsForUser,
} from "@nmi-agro/fdm-core"
import {
    ArrowRight,
    Check,
    Layers,
    LifeBuoy,
    MapIcon,
    Mountain,
    Plus,
    PlusCircle,
} from "lucide-react"
import { useMemo } from "react"
import {
    type ActionFunctionArgs,
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    useLoaderData,
} from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import {
    FarmCard,
    type FarmWithRoles,
} from "~/components/blocks/farm/farm-card"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { PendingInvitationCard } from "~/components/blocks/farm/pending-invitation"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { SidebarInset } from "~/components/ui/sidebar"
import { auth, getSession } from "~/lib/auth.server"
import { getCalendarSelection } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { getTimeBasedGreeting } from "~/lib/greetings"
import { AccessFormSchema } from "~/lib/schemas/access.schema"
import { OrganizationCard } from "../components/blocks/organization/organization-card"
import { PendingOrganizationInvitationCard } from "../components/blocks/organization/pending-organization-invitation"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Bedrijf | ${clientConfig.name}` },
        {
            name: "description",
            content: "Beheer uw landbouwbedrijf en percelen.",
        },
    ]
}

/**
 * Retrieves the user session and associated farms data, including the user's role.
 *
 * The function obtains the user session from the incoming request and then fetches the user's farms using the session's principal ID. It maps the farm data into a simplified array containing each farm's identifier, name, and the user's role. It returns this alongside the user's name.
 *
 * @param request - The HTTP request object used to retrieve session information.
 * @returns An object containing:
 *   - farmsWithRoles: An array of objects, each with a farm's ID, name, and the user's role.
 *   - username: The user's name from the session data.
 *
 * @throws {Error} If retrieving the session or fetching the farm data fails.
 */
export async function loader({ request }: LoaderFunctionArgs) {
    try {
        // Get the session
        const session = await getSession(request)

        // Get latest available year
        const calendar = getCalendarSelection()[0] ?? "all"

        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, session.principal_id)
        const farmOptions = farms.map((farm) => {
            return {
                b_id_farm: farm.b_id_farm,
                b_name_farm: farm.b_name_farm,
            }
        })

        // Get pending farm invitations for this user
        const pendingInvitations = await listPendingInvitationsForUser(
            fdm,
            session.user.id,
        )

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

        const rawOrganizations = await auth.api.listOrganizations({
            headers: request.headers,
        })
        const organizations = await Promise.all(
            rawOrganizations.map(async (organization) => {
                const membersListResponse = await auth.api.listMembers({
                    headers: request.headers,
                    query: {
                        organizationId: organization.id,
                    },
                })

                const userRoles = membersListResponse.members
                    .filter((member) => member.userId === session.principal_id)
                    .map((member) => member.role)

                const orderedUserRoles = (
                    ["owner", "admin", "member"] as const
                ).filter((r) => userRoles.includes(r))

                return {
                    ...organization,
                    userRoles: orderedUserRoles,
                    metadata: parseMetadata(
                        organization.slug,
                        organization.metadata,
                    ),
                }
            }),
        )

        const pendingOrganizationInvitations =
            await auth.api.listUserInvitations({
                headers: request.headers,
            })

        // Return user information from loader
        return {
            farms: farms.map((farm) => {
                const allOrganizationRoles = farm.roles.filter(
                    (role) => role.principal_type === "organization",
                )

                // Find the organization with the most significant role
                const roleHierarchy = [
                    "owner",
                    "advisor",
                    "researcher",
                ] as const
                allOrganizationRoles.sort(
                    (role1, role2) =>
                        roleHierarchy.indexOf(role1.role) -
                        roleHierarchy.indexOf(role2.role),
                )
                const organization = allOrganizationRoles
                    .map((role) =>
                        organizations.find(
                            (organization) =>
                                organization.id === role.principal_id,
                        ),
                    )
                    .find((organization) => organization)

                // Collect the user roles
                const userRoles = [
                    ...new Set(
                        farm.roles
                            .filter((role) => role.principal_type === "user")
                            .map((role) => role.role),
                    ),
                ]
                // Collect the roles for the chosen most significant organization
                const organizationRoles = organization
                    ? [
                          ...new Set(
                              farm.roles
                                  .filter(
                                      (role) =>
                                          role.principal_type ===
                                              "organization" &&
                                          role.principal_id === organization.id,
                                  )
                                  .map((role) => role.role),
                          ),
                      ]
                    : []
                return {
                    ...farm,
                    userRoles: userRoles,
                    organizationRoles: organizationRoles,
                    organization: organization,
                } satisfies FarmWithRoles
            }),
            farmOptions: farmOptions,
            organizations: organizations,
            calendar: calendar,
            username: session.userName,
            pendingInvitations: pendingInvitations,
            pendingOrganizationInvitations: pendingOrganizationInvitations,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export async function action({ request }: ActionFunctionArgs) {
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

        if (formValues.intent === "accept_organization_invitation") {
            if (!formValues.invitation_id) {
                return dataWithError(null, "Ontbrekend uitnodigings id")
            }
            await auth.api.acceptInvitation({
                headers: request.headers,
                body: { invitationId: formValues.invitation_id },
            })
            return dataWithSuccess(null, {
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
            return dataWithSuccess(null, {
                message: "Uitnodiging geweigerd.",
            })
        }

        return dataWithError(null, "Onbekende actie")
    } catch (error) {
        console.error(error)
        return dataWithError(null, "Er is iets misgegaan")
    }
}

function SupportNote() {
    return (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <LifeBuoy className="h-4 w-4" />
            <span>
                Hulp nodig of vragen? Neem contact op via{" "}
                <button
                    type="button"
                    onClick={() => {
                        const supportEmail = `support@${window.location.hostname}`
                        window.location.href = `mailto:${supportEmail}`
                    }}
                    className="font-medium text-primary hover:underline"
                >
                    ondersteuning
                </button>
            </span>
        </div>
    )
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
    const greeting = getTimeBasedGreeting()

    const [userFarms, organizationFarms] = useMemo(() => {
        const userFarms = loaderData.farms
            .filter((farm) => farm.userRoles.length > 0)
            .map((farm) => ({
                ...farm,
                organization: undefined,
                organizationRoles: undefined,
            }))
        const organizationFarms = loaderData.farms.filter(
            (farm) => farm.organization,
        )
        return [userFarms, organizationFarms]
    }, [loaderData])

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarm
                    b_id_farm={undefined}
                    farmOptions={loaderData.farmOptions}
                />
            </Header>
            <main className="flex flex-1 flex-col">
                {loaderData.farms.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center p-6 md:p-10">
                        <div className="mx-auto flex w-full max-w-212.5 flex-col items-center space-y-8 text-center">
                            <div className="space-y-4">
                                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                                    Welkom bij {clientConfig.name}
                                </h1>
                                <p className="mx-auto max-w-162.5 text-lg text-muted-foreground sm:text-xl font-medium">
                                    Een open-source platform voor goede
                                    landbouwpraktijk om samen te leren en
                                    innoveren.
                                </p>
                            </div>

                            <div className="grid w-full gap-6 sm:grid-cols-2">
                                <Card className="group relative flex flex-col overflow-hidden border-2 transition-all hover:border-primary/50 hover:shadow-xl">
                                    <CardHeader className="pb-4">
                                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground text-left">
                                            <PlusCircle className="h-7 w-7" />
                                        </div>
                                        <CardTitle className="text-2xl text-left">
                                            Bedrijf aanmaken
                                        </CardTitle>
                                        <CardDescription className="text-base text-left">
                                            Beheer uw percelen en bereken
                                            bemestingsadviezen conform de
                                            actuele gebruiksnormen.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="grow text-sm text-muted-foreground text-left">
                                        <ul className="space-y-3">
                                            <li className="flex items-start gap-3">
                                                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                                                <span>
                                                    <b>Balansen:</b> Inzicht in
                                                    stikstof- en organische
                                                    stofbalansen voor effectieve
                                                    doelsturing op
                                                    bodemvruchtbaarheid en
                                                    emissiereductie.
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                                                <span>
                                                    <b>Bemestingsadvies:</b>{" "}
                                                    Adviezen op basis van
                                                    bodemanalyse en
                                                    gewasbehoefte.
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                                                <span>
                                                    <b>Gebruiksruimte:</b> Houd
                                                    uw gebruiksruimte voor
                                                    stikstof, dierlijke mest en
                                                    fosfaat in de gaten.
                                                </span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                    <CardFooter className="pt-2">
                                        <Button
                                            asChild
                                            className="w-full"
                                            size="lg"
                                        >
                                            <NavLink to="/farm/create">
                                                Maak een bedrijf aan
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </NavLink>
                                        </Button>
                                    </CardFooter>
                                </Card>

                                <Card className="group relative flex flex-col overflow-hidden border-2 transition-all hover:border-primary/50 hover:shadow-xl">
                                    <CardHeader className="pb-4">
                                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground text-left">
                                            <Layers className="h-7 w-7" />
                                        </div>
                                        <CardTitle className="text-2xl text-left">
                                            Atlas verkennen
                                        </CardTitle>
                                        <CardDescription className="text-base text-left">
                                            Analyseer percelen op basis van
                                            openbare data, bodemkenmerken en
                                            historie.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="grow text-sm text-muted-foreground text-left">
                                        <ul className="space-y-3">
                                            <li className="flex items-start gap-3">
                                                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                                                <span>
                                                    <b>Percelen:</b>{" "}
                                                    Gewashistorie (BRP) en
                                                    kenmerken van alle percelen
                                                    in Nederland sinds 2009.
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                                                <span>
                                                    <b>Hoogtekaart:</b>{" "}
                                                    Gedetailleerde AHN4-data
                                                    voor inzicht in het
                                                    microreliëf van percelen.
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                                                <span>
                                                    <b>Bodemkaart:</b> Bekijk de
                                                    Bodemkaart van Nederland en
                                                    leer meer over uw bodem.
                                                </span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                    <CardFooter className="pt-2">
                                        <Button
                                            asChild
                                            variant="outline"
                                            className="w-full"
                                            size="lg"
                                        >
                                            <NavLink
                                                to={`/farm/undefined/${loaderData.calendar}/atlas/fields`}
                                            >
                                                Verken de Atlas
                                            </NavLink>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </div>

                            {loaderData.pendingInvitations.length > 0 && (
                                <div className="w-full space-y-4">
                                    <h2 className="text-xl font-semibold">
                                        Openstaande uitnodigingen
                                    </h2>
                                    <div className="grid w-full gap-4 sm:grid-cols-2">
                                        {loaderData.pendingInvitations.map(
                                            (invitation) => (
                                                <PendingInvitationCard
                                                    key={
                                                        invitation.invitation_id
                                                    }
                                                    invitation={invitation}
                                                />
                                            ),
                                        )}
                                    </div>
                                </div>
                            )}

                            <SupportNote />
                        </div>
                    </div>
                ) : (
                    <>
                        <FarmTitle
                            title={`${greeting}, ${loaderData.username}! 👋`}
                            description={
                                "Selecteer een bedrijf voor beheer en analyses, waaronder stikstof- en organische stofbalansen voor effectieve doelsturing."
                            }
                            action={{
                                to: "/farm/create",
                                label: "Nieuw bedrijf",
                            }}
                        />
                        <div className="grid gap-6 p-6 md:p-10 md:pt-0 lg:grid-cols-2 xl:grid-cols-3">
                            {userFarms.map((farm) => (
                                <FarmCard key={farm.b_id_farm} farm={farm} />
                            ))}

                            <Card className="flex flex-col border-dashed transition-all hover:border-primary/50 hover:bg-muted/50">
                                <NavLink
                                    to="/farm/create"
                                    className="flex h-full flex-col"
                                >
                                    <CardHeader className="grow items-center justify-center text-center">
                                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                            <Plus className="h-6 w-6" />
                                        </div>
                                        <CardTitle>Nieuw bedrijf</CardTitle>
                                        <CardDescription>
                                            Voeg een extra bedrijf toe aan uw
                                            account.
                                        </CardDescription>
                                    </CardHeader>
                                </NavLink>
                            </Card>
                        </div>

                        {/* Pending farm invitations */}
                        {loaderData.pendingInvitations.length > 0 && (
                            <>
                                <FarmTitle
                                    title="Openstaande uitnodigingen"
                                    description="Je hebt uitnodigingen ontvangen voor toegang tot de volgende bedrijven."
                                />
                                <div className="grid gap-4 p-6 md:p-10 md:pt-0 lg:grid-cols-2 xl:grid-cols-3">
                                    {loaderData.pendingInvitations.map(
                                        (invitation) => (
                                            <PendingInvitationCard
                                                key={invitation.invitation_id}
                                                invitation={invitation}
                                            />
                                        ),
                                    )}
                                </div>
                            </>
                        )}

                        {organizationFarms.length > 0 && (
                            <>
                                <FarmTitle
                                    title="Bedrijven van uw organisaties"
                                    description={
                                        "Selecteer een bedrijf van je organisaties voor beheer en analyses."
                                    }
                                />

                                <div className="grid gap-6 p-6 md:p-10 md:pt-0 lg:grid-cols-2 xl:grid-cols-3">
                                    {organizationFarms.map((farm) => (
                                        <FarmCard
                                            key={farm.b_id_farm}
                                            farm={farm}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        <FarmTitle
                            title="Atlas"
                            description="Toegang tot landelijke kaarten met informatie over percelen, bodem en hoogte."
                        />
                        <div className="grid gap-6 p-6 md:p-10 md:pt-0 lg:grid-cols-2 xl:grid-cols-3">
                            <Card className="group relative flex flex-col transition-all hover:border-primary/50 hover:shadow-md">
                                <NavLink
                                    to={`/farm/undefined/${loaderData.calendar}/atlas/fields`}
                                    className="flex h-full flex-col"
                                >
                                    <CardHeader>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                                                <MapIcon className="h-5 w-5" />
                                            </div>
                                            <CardTitle className="text-xl">
                                                Percelen
                                            </CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="grow text-sm text-muted-foreground">
                                        Bekijk de teelthistorie en ruimtelijke
                                        kenmerken van alle percelen in
                                        Nederland.
                                    </CardContent>
                                    <CardFooter className="border-t bg-muted/50 py-3 group-hover:bg-primary/5">
                                        <span className="flex items-center text-sm font-semibold text-primary transition-transform group-hover:translate-x-1">
                                            Naar percelen{" "}
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </span>
                                    </CardFooter>
                                </NavLink>
                            </Card>

                            <Card className="group relative flex flex-col transition-all hover:border-primary/50 hover:shadow-md">
                                <NavLink
                                    to={`/farm/undefined/${loaderData.calendar}/atlas/elevation`}
                                    className="flex h-full flex-col"
                                >
                                    <CardHeader>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                                                <Mountain className="h-5 w-5" />
                                            </div>
                                            <CardTitle className="text-xl">
                                                Hoogtekaart
                                            </CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="grow text-sm text-muted-foreground">
                                        Inzage in het Actueel Hoogtebestand
                                        Nederland (AHN) voor gedetailleerde
                                        hoogte-informatie.
                                    </CardContent>
                                    <CardFooter className="border-t bg-muted/50 py-3 group-hover:bg-primary/5">
                                        <span className="flex items-center text-sm font-semibold text-primary transition-transform group-hover:translate-x-1">
                                            Naar hoogtekaart{" "}
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </span>
                                    </CardFooter>
                                </NavLink>
                            </Card>
                            <Card className="group relative flex flex-col transition-all hover:border-primary/50 hover:shadow-md">
                                <NavLink
                                    to={`/farm/undefined/${loaderData.calendar}/atlas/soil`}
                                    className="flex h-full flex-col"
                                >
                                    <CardHeader>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                                                <Layers className="h-5 w-5" />
                                            </div>
                                            <CardTitle className="text-xl">
                                                Bodemkaart
                                            </CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="grow text-sm text-muted-foreground">
                                        Raadpleeg de landelijke bodemkaart voor
                                        informatie over bodemtype en
                                        grondwatertrappen.
                                    </CardContent>
                                    <CardFooter className="border-t bg-muted/50 py-3 group-hover:bg-primary/5">
                                        <span className="flex items-center text-sm font-semibold text-primary transition-transform group-hover:translate-x-1">
                                            Naar bodemkaart{" "}
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </span>
                                    </CardFooter>
                                </NavLink>
                            </Card>
                        </div>
                        {loaderData.organizations.length > 0 ||
                        loaderData.pendingOrganizationInvitations.length > 0 ? (
                            <>
                                <FarmTitle
                                    title="Organisaties"
                                    description="Werk samen met andere gebruikers op bedrijven in een gemakkelijke manier."
                                    action={{
                                        label: "Naar organisaties",
                                        to: "/organization",
                                    }}
                                />
                                {loaderData.organizations.length > 0 && (
                                    <div className="grid gap-6 p-6 md:p-10 md:pt-0 lg:grid-cols-2 xl:grid-cols-3">
                                        {loaderData.organizations.map(
                                            (organization) => (
                                                <OrganizationCard
                                                    key={organization.id}
                                                    organization={organization}
                                                />
                                            ),
                                        )}

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
                                                        Voeg een extra
                                                        organisatie toe aan uw
                                                        account.
                                                    </CardDescription>
                                                </CardHeader>
                                            </NavLink>
                                        </Card>
                                    </div>
                                )}
                                {loaderData.pendingOrganizationInvitations
                                    .length > 0 && (
                                    <>
                                        {loaderData.organizations.length >
                                            0 && (
                                            <FarmTitle
                                                title="Openstaande uitnodigingen naar organisaties"
                                                description="Je hebt uitnodigingen ontvangen voor toegang tot de volgende organisaties."
                                            />
                                        )}
                                        <div className="grid w-full mx-6 p-6 gap-4 sm:grid-cols-2">
                                            {loaderData.pendingOrganizationInvitations.map(
                                                (invitation) => (
                                                    <PendingOrganizationInvitationCard
                                                        key={invitation.id}
                                                        invitation={invitation}
                                                    />
                                                ),
                                            )}
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <FarmTitle
                                    title="Organisaties"
                                    description="Werk samen met andere gebruikers op bedrijven in een gemakkelijke manier."
                                    action={{
                                        label: "Naar organisaties",
                                        to: "/organization",
                                    }}
                                />
                                <div className="mx-auto flex items-center flex-col justify-center space-y-6 sm:w-87.5">
                                    <div className="flex flex-col space-y-2 text-center">
                                        <h1 className="text-2xl font-semibold tracking-tight">
                                            Het lijkt erop dat je nog geen
                                            organisatie hebt.
                                        </h1>
                                    </div>
                                    <div className="flex flex-col items-center relative">
                                        <Button asChild>
                                            <NavLink to="/organization/new">
                                                Maak een organisatie
                                            </NavLink>
                                        </Button>
                                    </div>
                                    <p className="text-center text-sm text-muted-foreground">
                                        of kunt u organisaties vragen om u uit
                                        te nodigen.
                                    </p>
                                </div>
                            </>
                        )}
                        <SupportNote />
                    </>
                )}
            </main>
        </SidebarInset>
    )
}
