import { getFarm } from "@nmi-agro/fdm-core"
import { DownloadCloud, Map as MapIcon, UploadCloud } from "lucide-react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { data, NavLink, useLoaderData } from "react-router"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "~/components/ui/accordion"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { SidebarInset } from "~/components/ui/sidebar"
import { getRvoCredentials } from "~/integrations/rvo.server"
import { clientConfig } from "~/lib/config"
import { fdm } from "~/lib/fdm.server"
import { cn } from "~/lib/utils"
import { getSession } from "../lib/auth.server"

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Percelen importeren - Bedrijf toevoegen | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Importeer de percelen van je bedrijf.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
        throw new Error("b_id_farm is required")
    }

    // Get the session
    const session = await getSession(request)

    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
    if (!farm) {
        throw data("Farm not found", {
            status: 404,
            statusText: "Farm not found",
        })
    }

    // Check if RVO import is available
    const isRvoConfigured = getRvoCredentials() !== undefined

    return { farm, isRvoConfigured }
}

export default function ChooseFieldImportMethod() {
    const { farm, isRvoConfigured } = useLoaderData<typeof loader>()
    const isRvoEnabled = useFeatureFlagEnabled("rvo") ?? true
    const showRvoOption = isRvoConfigured && isRvoEnabled !== false

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarmCreate b_name_farm={farm.b_name_farm} />
            </Header>
            <main className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-4xl">
                    <h1 className="text-2xl font-bold text-center mb-2">
                        Percelen importeren
                    </h1>
                    <p className="text-muted-foreground text-center mb-8">
                        Hoe wil je de percelen van je bedrijf importeren?
                    </p>
                    <div
                        className={cn(
                            "grid gap-8",
                            showRvoOption ? "md:grid-cols-3" : "md:grid-cols-2",
                        )}
                    >
                        {showRvoOption && (
                            <Card className="flex flex-col">
                                <CardHeader className="items-center text-center">
                                    <DownloadCloud className="w-12 h-12 mb-4" />
                                    <CardTitle>Importeren vanuit RVO</CardTitle>
                                    <CardDescription>
                                        Importeer je percelen door via
                                        eHerkenning toestemming te geven.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grow flex flex-col justify-between">
                                    <Accordion
                                        type="single"
                                        collapsible
                                        className="w-full"
                                    >
                                        <AccordionItem value="item-1">
                                            <AccordionTrigger>
                                                Wat heb ik nodig om percelen te
                                                importeren vanuit RVO?
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <ol className="list-decimal list-inside space-y-2">
                                                    <li>
                                                        U heeft een geldig
                                                        KvK-nummer gekoppeld aan
                                                        uw account.
                                                    </li>
                                                    <li>
                                                        U heeft een eHerkenning
                                                        account met machtiging
                                                        voor dit KvK-nummer.
                                                    </li>
                                                    <li>
                                                        U geeft ons toestemming
                                                        om perceelsgegevens op
                                                        te halen.
                                                    </li>
                                                </ol>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                    <NavLink to="./rvo" className="w-full mt-4">
                                        <Button className="w-full">
                                            Importeren vanuit RVO
                                        </Button>
                                    </NavLink>
                                </CardContent>
                            </Card>
                        )}
                        <Card className="flex flex-col">
                            <CardHeader className="items-center text-center">
                                <UploadCloud className="w-12 h-12 mb-4" />
                                <CardTitle>Upload Shapefile</CardTitle>
                                <CardDescription>
                                    Importeer je percelen door een Shapefile van
                                    RVO Mijn Percelen te uploaden.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grow flex flex-col justify-between">
                                <Accordion
                                    type="single"
                                    collapsible
                                    className="w-full"
                                >
                                    <AccordionItem value="item-1">
                                        <AccordionTrigger>
                                            Hoe download ik een shapefile van
                                            mijn.rvo.nl?
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <ol className="list-decimal list-inside space-y-2">
                                                <li>Log in op mijn.rvo.nl.</li>
                                                <li>
                                                    Ga via "Registratie en
                                                    meldingen doorgeven" naar
                                                    "Percelen registreren".
                                                </li>
                                                <li>
                                                    Klik op "Registreren en
                                                    wijzigen" onder "Mijn
                                                    percelen".
                                                </li>
                                                <li>
                                                    Ga bij "Mijn percelen" naar
                                                    "Wijzigen".
                                                </li>
                                                <li>
                                                    Klik op de datum om het
                                                    juiste jaar en de juiste
                                                    peildatum in te stellen
                                                    waarvoor u de gecombineerde
                                                    opgave wilt downloaden.
                                                </li>
                                                <li>
                                                    Klik op het zwarte/blauwe
                                                    pijltje dat naar beneden
                                                    wijst. Vervolgens verschijnt
                                                    er een klein uitklapmenu
                                                    waar "Shape" tussen staat.
                                                    Klik hierop om de download
                                                    te starten.
                                                </li>
                                            </ol>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                                <NavLink to="./upload" className="w-full mt-4">
                                    <Button className="w-full">
                                        Bestand uploaden
                                    </Button>
                                </NavLink>
                            </CardContent>
                        </Card>
                        <Card className="flex flex-col">
                            <CardHeader className="items-center text-center">
                                <MapIcon className="w-12 h-12 mb-4" />
                                <CardTitle>Selecteer op de kaart</CardTitle>
                                <CardDescription>
                                    Selecteer je percelen direct op de kaart.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grow flex items-end justify-center">
                                <NavLink to="./atlas" className="w-full">
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                    >
                                        Naar de kaart
                                    </Button>
                                </NavLink>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </SidebarInset>
    )
}
