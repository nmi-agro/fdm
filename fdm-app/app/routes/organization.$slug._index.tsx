import { getFarms, getFields } from "@svenvw/fdm-core"
import { Cog, Square, Users } from "lucide-react"
import { data, NavLink, useLoaderData } from "react-router"
import { FarmCard } from "~/components/blocks/farm/farm-card"
import { FarmContent } from "~/components/blocks/farm/farm-content"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { SidebarInset } from "~/components/ui/sidebar"
import { auth, getSession } from "~/lib/auth.server"
import { getCalendarSelection } from "~/lib/calendar"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { useCalendarStore } from "~/store/calendar"
import type { Route } from "./+types/organization.$slug._index"

export async function loader({ params, request }: Route.LoaderArgs) {
    try {
        const session = await getSession(request)
        const organizations = await auth.api.listOrganizations({
            headers: request.headers,
        })

        const organization = organizations.find(
            (org) => org.slug === params.slug,
        )

        if (!organization) {
            throw data("Organisatie niet gevonden.", 404)
        }

        const members = await auth.api.listMembers({
            headers: request.headers,
            query: { organizationSlug: params.slug },
        })

        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, organization.id)

        // Get latest available year
        const calendar = getCalendarSelection()[0] ?? "all"

        const farmsExtended = await Promise.all(
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
                                    Bedrijven met Toegang
                                </h2>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {loaderData.farms.map((farm) => (
                                        <FarmCard
                                            key={farm.b_id_farm}
                                            farm={farm}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-8">
                            {/* Overview */}
                            <div className="space-y-4">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    Overzicht
                                </h2>
                                <Card>
                                    <CardContent className="pt-6 space-y-4">
                                        <dl className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <dt className="text-muted-foreground">
                                                    Aantal bedrijven
                                                </dt>
                                                <dd className="font-semibold">
                                                    {loaderData.farms.length}
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <dt className="text-muted-foreground">
                                                    Totale oppervlakte
                                                </dt>
                                                <dd className="font-semibold">
                                                    {loaderData.totalArea} ha
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">
                                                    Jaar
                                                </span>
                                                <Select
                                                    value={calendar}
                                                    onValueChange={(value) =>
                                                        setCalendar(value)
                                                    }
                                                >
                                                    <SelectTrigger className="w-[180px]">
                                                        <SelectValue placeholder="Select a year" />
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
                                        </dl>
                                        <Button
                                            variant="ghost"
                                            className="flex justify-start -mx-3"
                                            asChild
                                        >
                                            <NavLink to="settings">
                                                <Cog className="mr-2 h-4 w-4" />
                                                Instellingen
                                            </NavLink>
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Settings */}
                            <div className="space-y-4">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    Leden
                                </h2>
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
