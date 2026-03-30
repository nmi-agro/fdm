import { Link, Form } from "react-router"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
    Loader2,
    FlaskConical,
    CheckCircle2,
    ExternalLink,
} from "lucide-react"

interface RvoConnectCardProps {
    b_businessid_farm: string | null
    b_id_farm: string
    isImporting: boolean
    isRvoConfigured: boolean
}

export function RvoConnectCard({
    b_businessid_farm,
    b_id_farm,
    isImporting,
    isRvoConfigured,
}: RvoConnectCardProps) {
    return (
        <Card className="w-full">
            <CardHeader className="space-y-6">
                <CardTitle>Percelen ophalen bij RVO</CardTitle>
                <Alert>
                    <FlaskConical className="h-4 w-4" />
                    <AlertTitle>Experimentele functie</AlertTitle>
                    <AlertDescription className="text-muted-foreground">
                        Deze functie is nog in ontwikkeling. Laat ons het weten
                        als je feedback hebt!
                    </AlertDescription>
                </Alert>
                <CardDescription>
                    Lees hieronder wat u nodig heeft om te verbinden.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-md border border-slate-100">
                    <h4 className="font-semibold text-slate-900 mb-2">
                        Voorwaarden voor gebruik:
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                        <li>
                            U heeft een geldig KvK-nummer gekoppeld aan uw
                            account.
                        </li>
                        <li>
                            U heeft een eHerkenning account met machtiging voor
                            dit KvK-nummer.
                        </li>
                        <li>
                            U geeft ons toestemming om perceelsgegevens op te
                            halen.
                        </li>
                    </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 mt-6">
                    <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-2">
                            KvK Nummer
                        </h4>
                        {b_businessid_farm ? (
                            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded text-green-800">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="font-mono font-medium">
                                    {b_businessid_farm}
                                </span>
                            </div>
                        ) : (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                                Geen KvK-nummer gevonden. Voeg deze toe in de
                                bedrijfsgegevens.
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-2">
                            Wat gebeurt er?
                        </h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            Na het klikken op "Verbinden met RVO" wordt u
                            doorgestuurd naar de inlogpagina van RVO. Na
                            authenticatie met eHerkenning keert u terug naar
                            deze pagina om de verschillen te beoordelen.
                        </p>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end pt-2">
                {!b_businessid_farm ? (
                    <Button variant="outline" asChild className="w-full">
                        <Link to={`/farm/${b_id_farm}/settings`}>
                            KvK-nummer toevoegen
                        </Link>
                    </Button>
                ) : (
                    <Form method="post" className="w-full">
                        <input
                            type="hidden"
                            name="intent"
                            value="start_import"
                        />
                        <Button
                            type="submit"
                            disabled={isImporting || !isRvoConfigured}
                            className="w-full"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verbinden met RVO...
                                </>
                            ) : (
                                <>
                                    Verbinden met RVO
                                    <ExternalLink className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </Form>
                )}
            </CardFooter>
        </Card>
    )
}
