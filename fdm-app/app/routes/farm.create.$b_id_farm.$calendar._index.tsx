import { getFarm } from "@nmi-agro/fdm-core"
import { Map as MapIcon, UploadCloud } from "lucide-react"
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
import { clientConfig } from "~/lib/config"
import { getSession } from "../lib/auth.server"
import { fdm } from "../lib/fdm.server"

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

    return { farm }
}

export default function ChooseFieldImportMethod() {
    const { farm } = useLoaderData<typeof loader>()

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
                    <div className="grid md:grid-cols-2 gap-8">
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
