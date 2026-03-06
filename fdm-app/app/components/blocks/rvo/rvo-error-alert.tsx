import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Link } from "react-router"

interface RvoErrorAlertProps {
    error: string | Error
    onRetry?: () => void
    retryPath?: string
}

export function RvoErrorAlert({
    error,
    onRetry,
    retryPath,
}: RvoErrorAlertProps) {
    const rawMessage = typeof error === "string" ? error : error.message
    let friendlyTitle = "Er is iets misgegaan"
    let friendlyMessage =
        "Er is een onverwachte fout opgetreden. Probeer het later opnieuw."

    // Map technical errors to user-friendly messages
    if (
        rawMessage.includes("TVS Authorize Endpoint") ||
        rawMessage.includes("TVS Token Endpoint") ||
        rawMessage.includes("Client Name is required") ||
        rawMessage.includes("PKIO Private Key") ||
        rawMessage.includes("configuration is missing")
    ) {
        friendlyTitle = "Configuratiefout"
        friendlyMessage =
            "De RVO koppeling is niet correct geconfigureerd op deze server. Neem contact op met de beheerder."
    } else if (
        rawMessage.includes("Failed to obtain access token") ||
        rawMessage.includes("Access token is missing")
    ) {
        friendlyTitle = "Authenticatie mislukt"
        friendlyMessage =
            "Het is niet gelukt om in te loggen bij RVO of uw sessie is verlopen. Probeer opnieuw verbinding te maken."
    } else if (rawMessage.includes("Request failed: 500")) {
        friendlyTitle = "RVO Storing"
        friendlyMessage =
            "De RVO webservice geeft een interne serverfout (500). Dit ligt meestal aan RVO. Probeer het later opnieuw."
    } else if (
        rawMessage.includes("Request failed: 401") ||
        rawMessage.includes("Request failed: 403")
    ) {
        friendlyTitle = "Geen toegang"
        friendlyMessage =
            "U heeft geen toegang tot de gegevens van dit bedrijf bij RVO. Controleer of u de juiste eHerkenning machtigingen heeft voor dit KvK-nummer."
    } else if (rawMessage.includes("Request failed")) {
        friendlyTitle = "Communicatiefout"
        friendlyMessage = `Er is een fout opgetreden bij het ophalen van gegevens bij RVO. (${rawMessage})`
    } else if (rawMessage.includes("Zod") || rawMessage.includes("parse")) {
        friendlyTitle = "Gegevensfout"
        friendlyMessage =
            "De gegevens ontvangen van RVO kwamen niet overeen met het verwachte formaat."
    } else if (rawMessage.includes("b_businessid_farm is not available")) {
        friendlyTitle = "Geen KvK nummer"
        friendlyMessage =
            "Dit bedrijf heeft geen KvK nummer geconfigureerd. Voeg dit toe in de bedrijfsinstellingen."
    }

    return (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-900 font-semibold flex items-center gap-2">
                {friendlyTitle}
            </AlertTitle>
            <AlertDescription className="mt-2">
                <div className="flex flex-col gap-4 text-red-800">
                    <p>{friendlyMessage}</p>
                    {retryPath ? (
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="w-fit border-red-200 bg-white hover:bg-red-50 hover:text-red-900 text-red-700"
                        >
                            <Link to={retryPath}>
                                <RefreshCw className="mr-2 h-3 w-3" />
                                Opnieuw proberen
                            </Link>
                        </Button>
                    ) : onRetry ? (
                        <Button
                            type="button"
                            onClick={onRetry}
                            variant="outline"
                            size="sm"
                            className="w-fit border-red-200 bg-white hover:bg-red-50 hover:text-red-900 text-red-700"
                        >
                            <RefreshCw className="mr-2 h-3 w-3" />
                            Opnieuw proberen
                        </Button>
                    ) : null}
                </div>
                {process.env.NODE_ENV === "development" && (
                    <div className="mt-4 p-2 bg-red-100 rounded text-xs font-mono text-red-900 overflow-auto max-w-full">
                        <strong>DEBUG:</strong> {rawMessage}
                    </div>
                )}
            </AlertDescription>
        </Alert>
    )
}
