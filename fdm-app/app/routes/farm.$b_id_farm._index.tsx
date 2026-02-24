import { cowHead } from "@lucide/lab"
import { getFarm, getFarms, getFields } from "@nmi-agro/fdm-core"
import {
    ArrowRightLeft,
    BookOpenText,
    ChevronUp,
    DownloadIcon,
    Home,
    Icon,
    Landmark,
    Loader2,
    MapIcon,
    ScrollText,
    Shapes,
    Sprout,
    Square,
    Trash2,
    FileStack,
    UserRoundCheck,
    PlusIcon,
} from "lucide-react"
import { useState } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    useLoaderData,
} from "react-router"
import { toast } from "sonner"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
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
import { getSession } from "~/lib/auth.server"
import { getCalendarSelection } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { useCalendarStore } from "~/store/calendar"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Bedrijf | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk en bewerk de gegevens van je bedrijf.",
        },
    ]
}

/**
 * Processes a request to retrieve a farm's session details.
 *
 * This function extracts the farm ID from the route parameters and throws an error with a 400 status
 * if the ID is missing. When a valid farm ID is provided, it retrieves the session associated with the
 * incoming request and returns an object containing both the farm ID and the session information.
 *
 * @returns An object with "farmId" and "session" properties.
 *
 * @throws {Response} If the farm ID is not provided.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get the farm details
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)

        // Get the list of fields
        const fields = await getFields(fdm, session.principal_id, b_id_farm)

        // Calculate total area for this farm
        const farmArea = fields.reduce(
            (acc, field) => acc + (field.b_area ?? 0),
            0,
        )

        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, session.principal_id)
        const farmOptions = farms.map((farm) => {
            return {
                b_id_farm: farm.b_id_farm,
                b_name_farm: farm.b_name_farm,
            }
        })

        // Return the farm ID and session info
        return {
            b_id_farm: b_id_farm,
            b_name_farm: farm.b_name_farm,
            fieldsNumber: fields.length,
            farmArea: Math.round(farmArea),
            farmOptions: farmOptions,
            roles: farm.roles,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmDashboardIndex() {
    const loaderData = useLoaderData<typeof loader>()

    const calendar = useCalendarStore((state) => state.calendar)
    const setCalendar = useCalendarStore((state) => state.setCalendar)
    const years = getCalendarSelection()
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

    const handleDownloadPdf = async (e: React.MouseEvent) => {
        e.preventDefault()
        if (isGeneratingPdf) return

        setIsGeneratingPdf(true)
        toast.info("Bemestingsplan wordt gegenereerd", {
            description: "Dit kan enkele seconden duren...",
        })

        try {
            const response = await fetch(
                `/farm/${loaderData.b_id_farm}/${calendar}/bemestingsplan.pdf`,
            )
            if (!response.ok) throw new Error("Download failed")

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `Bemestingsplan_${loaderData.b_name_farm}_${calendar}.pdf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success("Download voltooid")
        } catch (error) {
            console.error(error)
            toast.error("Er ging iets mis bij het genereren van de PDF")
        } finally {
            setIsGeneratingPdf(false)
        }
    }

    return (
        <SidebarInset>
            <Header
                action={{
                    to: "/",
                    label: "Naar overzicht bedrijven",
                    disabled: false,
                }}
            >
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
            </Header>
            <main>
                <FarmTitle
                    title={`${loaderData.b_name_farm}`}
                    description={
                        "Een overzicht van de bedrijfsgegevens en applicaties."
                    }
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
                                    <NavLink to={`${calendar}/field`}>
                                        <Card className="transition-all hover:shadow-md">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-primary text-primary-foreground p-3">
                                                        <Square className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            Percelen
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Uitgebreide tabel
                                                            met o.a. gewassen en
                                                            gebruikte
                                                            meststoffen per
                                                            perceel.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>
                                    <NavLink to={`${calendar}/rotation`}>
                                        <Card className="transition-all hover:shadow-md">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-primary text-primary-foreground p-3">
                                                        <Sprout className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            Bouwplan
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Uitgebreide tabel
                                                            met o.a. zaaidata,
                                                            oogstdata en
                                                            gebruikte
                                                            meststoffen per
                                                            gewas.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>
                                </div>
                            </div>

                            {/* Apps */}
                            <div className="space-y-4">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    Apps
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <NavLink to={`${calendar}/atlas`}>
                                        <Card className="transition-all hover:shadow-md h-full">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-muted p-3">
                                                        <MapIcon className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            Atlas
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Gewaspercelen op de
                                                            kaart.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>
                                    <NavLink
                                        to={`${calendar}/balance/nitrogen`}
                                    >
                                        <Card className="transition-all hover:shadow-md h-full">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-muted p-3">
                                                        <ArrowRightLeft className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            Stikstofbalans
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Aanvoer, afvoer en
                                                            emissie van
                                                            stikstof.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>
                                    <NavLink
                                        to={`${calendar}/balance/nitrogen`}
                                    >
                                        <Card className="transition-all hover:shadow-md h-full">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-muted p-3">
                                                        <ArrowRightLeft className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            OS Balans
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Aanvoer en afbraak
                                                            van organische stof.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>

                                    <NavLink to={`${calendar}/nutrient_advice`}>
                                        <Card className="transition-all hover:shadow-md h-full">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-muted p-3">
                                                        <BookOpenText className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            Bemestingsadvies
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Volgens Handboek
                                                            Bodem en Bemesting
                                                            en Adviesbasis
                                                            Bemesting.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>
                                    <NavLink to={`${calendar}/norms`}>
                                        <Card className="transition-all hover:shadow-md h-full">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-muted p-3">
                                                        <Landmark className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            Gebruiksruimte
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Normen op bedrijfs-
                                                            en perceelsniveau.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>
                                    <Card
                                        className="transition-all hover:shadow-md h-full cursor-pointer"
                                        onClick={handleDownloadPdf}
                                    >
                                        <CardHeader>
                                            <div className="flex items-center gap-4">
                                                <div className="rounded-lg bg-muted p-3">
                                                    {isGeneratingPdf ? (
                                                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                                                    ) : (
                                                        <DownloadIcon className="h-6 w-6 text-primary" />
                                                    )}
                                                </div>
                                                <div>
                                                    <CardTitle>
                                                        Download bemestingsplan
                                                    </CardTitle>
                                                    <CardDescription>
                                                        pdf met gebruiksruimte
                                                        en bemestingsadvies op
                                                        bedrijfs- en
                                                        perceelsniveau.
                                                    </CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-4">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    Acties
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <NavLink to={"soil-analysis/bulk"}>
                                        <Card className="transition-all hover:shadow-md h-full">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-muted p-3">
                                                        <FileStack className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            Upload bodemanalyses
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Upload meerdere
                                                            pdf's met
                                                            bodemanalyses en
                                                            koppel ze aan
                                                            percelen.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>
                                    <NavLink to={`${calendar}/field/new`}>
                                        <Card className="transition-all hover:shadow-md h-full">
                                            <CardHeader>
                                                <div className="flex items-center gap-4">
                                                    <div className="rounded-lg bg-muted p-3">
                                                        <PlusIcon className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle>
                                                            Nieuwe percelen
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Voeg nieuwe percelen
                                                            toe aan dit bedrijf.
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </NavLink>
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
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">
                                                    Aantal percelen
                                                </span>
                                                <span className="font-semibold">
                                                    {loaderData.fieldsNumber}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">
                                                    Totale oppervlakte
                                                </span>
                                                <span className="font-semibold">
                                                    {loaderData.farmArea} ha
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">
                                                    Rol
                                                </span>
                                                <span className="font-semibold">
                                                    {loaderData.roles.includes(
                                                        "owner",
                                                    )
                                                        ? "Eigenaar"
                                                        : loaderData.roles.includes(
                                                                "advisor",
                                                            )
                                                          ? "Adviseur"
                                                          : loaderData.roles.includes(
                                                                  "researcher",
                                                              )
                                                            ? "Onderzoeker"
                                                            : loaderData
                                                                  .roles[0]}
                                                </span>
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
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Settings */}
                            <div className="space-y-4">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    Gegevens
                                </h2>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="space-y-1">
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                                asChild
                                            >
                                                <NavLink to="settings">
                                                    <Home className="mr-2 h-4 w-4" />
                                                    Bedrijf
                                                </NavLink>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                                asChild
                                            >
                                                <NavLink to="fertilizers">
                                                    <Shapes className="mr-2 h-4 w-4" />
                                                    Meststoffen
                                                </NavLink>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                                asChild
                                            >
                                                <NavLink to="settings/derogation">
                                                    <ChevronUp className="mr-2 h-4 w-4" />
                                                    Derogatie
                                                </NavLink>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                                asChild
                                            >
                                                <NavLink to="settings/organic-certification">
                                                    <ScrollText className="mr-2 h-4 w-4" />
                                                    Bio-certificaat
                                                </NavLink>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                                asChild
                                            >
                                                <NavLink to="settings/grazing-intention">
                                                    <Icon
                                                        iconNode={cowHead}
                                                        className="mr-2 h-4 w-4"
                                                    />
                                                    Beweiding
                                                </NavLink>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                                asChild
                                            >
                                                <NavLink to="settings/access">
                                                    <UserRoundCheck className="mr-2 h-4 w-4" />
                                                    Toegang
                                                </NavLink>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                                asChild
                                            >
                                                <NavLink to="settings/delete">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Verwijderen
                                                </NavLink>
                                            </Button>
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
