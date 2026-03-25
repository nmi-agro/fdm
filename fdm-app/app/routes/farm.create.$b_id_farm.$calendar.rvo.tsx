import {
    type ActionFunctionArgs,
    Form,
    type LoaderFunctionArgs,
    type MetaFunction,
    redirect,
    useActionData,
    useLoaderData,
    useNavigation,
    useLocation,
    data,
} from "react-router"
import { getSession } from "~/lib/auth.server"
import { extractErrorMessage } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
    generateAuthUrl,
    fetchRvoFields,
    compareFields,
    exchangeToken,
    processRvoImport,
} from "~/lib/rvo.server"
import type {
    RvoImportReviewItem,
    ImportReviewAction,
    UserChoiceMap,
} from "@nmi-agro/fdm-rvo/types"
import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import { RvoImportReviewTable } from "~/components/blocks/rvo/import-review-table"
import { type Cultivation, type Field, getFarm } from "@nmi-agro/fdm-core"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { SidebarInset } from "~/components/ui/sidebar"
import {
    BreadcrumbItem,
    BreadcrumbSeparator,
    BreadcrumbLink,
} from "~/components/ui/breadcrumb"
import {
    getRvoCredentials,
    createConfiguredRvoClient,
    createRvoState,
    verifyRvoState,
} from "~/integrations/rvo.server"
import { RvoErrorAlert } from "~/components/blocks/rvo/error-alert"
import {
    getNmiApiKey,
    getSoilParameterEstimates,
} from "~/integrations/nmi.server"
import {
    addSoilAnalysis,
    getCultivationsFromCatalogue,
    type FdmType,
} from "@nmi-agro/fdm-core"
import { RvoConnectCard } from "~/components/blocks/rvo/connect-card"

export const meta: MetaFunction = ({ params }) => {
    const b_id_farm = params.b_id_farm
    return [{ title: `Percelen ophalen bij RVO - Nieuw Bedrijf ${b_id_farm}` }]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    const { b_id_farm, calendar: yearString } = params
    if (!b_id_farm || !yearString) {
        throw new Response("Farm ID en kalender zijn verplicht", {
            status: 400,
        })
    }
    const year = Number(yearString)
    if (!Number.isInteger(year)) {
        throw new Response("Ongeldig kalenderjaar", { status: 400 })
    }

    const session = await getSession(request)
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")

    let RvoImportReviewData: RvoImportReviewItem<any>[] = []
    let error: string | null = null
    let b_businessid_farm: string | null = null
    let b_name_farm: string | null | undefined = null

    // Check if RVO is configured
    const rvoCredentials = getRvoCredentials()
    const isRvoConfigured = rvoCredentials !== undefined

    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
    if (farm) {
        b_businessid_farm = farm.b_businessid_farm
        b_name_farm = farm.b_name_farm
    }

    if (code && state) {
        try {
            if (!isRvoConfigured) {
                throw new Response("RVO client is not configured.", {
                    status: 500,
                })
            }

            // CSRF Verification
            await verifyRvoState(request, state, b_id_farm)

            if (!farm || !farm.b_businessid_farm) {
                throw new Response(
                    "Geen KvK-nummer gevonden voor dit bedrijf.",
                    { status: 400 },
                )
            }

            const rvoClient = createConfiguredRvoClient(rvoCredentials)
            
            try {
                await exchangeToken(rvoClient, code)
            } catch (e: any) {
                // Handle token exchange errors specifically for refreshes
                const originalError = e?.message || ""
                if (originalError.includes("invalid_grant") || originalError.includes("expired")) {
                    throw new Error("De eHerkenning sessie is verlopen door een paginaverversing of een verouderde link. Klik op 'Verbinden met RVO' om opnieuw te verbinden.")
                }
                throw e
            }

            const rvoFields = await fetchRvoFields(
                rvoClient,
                yearString,
                farm.b_businessid_farm,
            )

            const cultivationsCatalogue = await getCultivationsFromCatalogue(
                fdm,
                session.principal_id,
                b_id_farm,
            )

            const localFieldsExtended: (Field & {
                cultivations: Cultivation[]
            })[] = [] // No existing fields to compare against yet in create wizard, so localFields is empty
            RvoImportReviewData = compareFields(
                localFieldsExtended,
                rvoFields,
                year,
                cultivationsCatalogue,
            )
        } catch (e: any) {
            console.error("RVO Import Fout:", e)
            error = await extractErrorMessage(e)
        }
    } else if (!url.searchParams.has("start_import")) {
        return data({
            b_id_farm,
            b_businessid_farm,
            calendar: yearString,
            RvoImportReviewData: [],
            error: null,
            showImportButton: true,
            noRvoParcelsFound: false,
            isRvoConfigured,
            b_name_farm,
        })
    }

    const noRvoParcelsFound = !error && RvoImportReviewData.length === 0
    return data({
        b_id_farm,
        b_businessid_farm,
        calendar: yearString,
        RvoImportReviewData,
        error,
        showImportButton: noRvoParcelsFound,
        noRvoParcelsFound,
        isRvoConfigured,
        b_name_farm,
    })
}

export default function RvoImportCreatePage() {
    const {
        b_id_farm,
        b_businessid_farm,
        calendar,
        RvoImportReviewData,
        error,
        showImportButton,
        noRvoParcelsFound,
        isRvoConfigured,
        b_name_farm,
    } = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const navigation = useNavigation()
    const location = useLocation()

    const isImporting =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "start_import"
    const isSaving =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "save_fields"

    const [userChoices, setUserChoices] = useState<UserChoiceMap>({})

    useEffect(() => {
        // Initialize user choices with defaults
        const initialChoices: UserChoiceMap = {}
        RvoImportReviewData.forEach((item) => {
            const id = getItemId(item)
            let defaultAction: ImportReviewAction

            switch (item.status) {
                case "NEW_REMOTE":
                    defaultAction = "ADD_REMOTE"
                    break
                // In creation wizard, other statuses are unlikely but good to handle defaults
                default:
                    defaultAction = "NO_ACTION"
                    break
            }
            initialChoices[id] = defaultAction
        })
        setUserChoices(initialChoices)
    }, [RvoImportReviewData])

    // Warn the user before refreshing or leaving when data is present
    useEffect(() => {
        if (RvoImportReviewData.length > 0) {
            const handleBeforeUnload = (e: BeforeUnloadEvent) => {
                e.preventDefault()
                e.returnValue = "Als u de pagina ververst, wordt de verbinding met RVO verbroken en moet u opnieuw inloggen met eHerkenning. Wilt u doorgaan?"
                return e.returnValue
            }
            window.addEventListener("beforeunload", handleBeforeUnload)
            return () => window.removeEventListener("beforeunload", handleBeforeUnload)
        }
    }, [RvoImportReviewData])

    const handleChoiceChange = (id: string, action: ImportReviewAction) => {
        setUserChoices((prev: UserChoiceMap) => ({ ...prev, [id]: action }))
    }

    if (error) {
        return (
            <SidebarInset>
                <Header action={undefined}>
                    <HeaderFarmCreate b_name_farm={b_name_farm} />
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink>
                            Percelen ophalen bij RVO
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                </Header>
                <main className="flex-1 overflow-auto">
                    <div className="flex items-center justify-between">
                        <FarmTitle
                            title="Fout bij ophalen percelen bij RVO"
                            description="Er is iets misgegaan bij het ophalen van de gegevens."
                        />
                    </div>
                    <FarmContent>
                        <div className="flex flex-col space-y-8 pb-10 lg:flex-row lg:space-x-12 lg:space-y-0">
                            <div className="w-full">
                                <RvoErrorAlert
                                    error={error}
                                    retryPath={location.pathname}
                                />
                            </div>
                        </div>
                    </FarmContent>
                </main>
            </SidebarInset>
        )
    }

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarmCreate b_name_farm={b_name_farm} />
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbLink>Percelen ophalen bij RVO</BreadcrumbLink>
                </BreadcrumbItem>
            </Header>
            <main className="flex-1 overflow-auto">
                {actionData?.message && (
                    <div className="p-6">
                        <Alert
                            variant={
                                actionData.success ? "default" : "destructive"
                            }
                        >
                            <AlertTitle>
                                {actionData.success ? "Succes" : "Fout"}
                            </AlertTitle>
                            <AlertDescription>
                                {actionData.message}
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
                {/* Config Warning */}
                {!isRvoConfigured && (
                    <div className="p-6">
                        <Alert
                            variant="destructive"
                            className="border-red-200 bg-red-50 text-red-800"
                        >
                            <AlertTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Percelen ophalen bij RVO is niet beschikbaar
                            </AlertTitle>
                            <AlertDescription>
                                De RVO koppeling is nog niet ingesteld op deze
                                server. Neem contact op met de beheerder om de
                                RVO toeggangegevens toe te voegen.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                {RvoImportReviewData.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-6">
                        <div className="w-full max-w-lg space-y-6">
                            {noRvoParcelsFound && (
                                <Alert>
                                    <AlertTitle>
                                        Geen percelen gevonden
                                    </AlertTitle>
                                    <AlertDescription>
                                        Er zijn geen percelen gevonden voor dit
                                        bedrijf bij RVO. Controleer het
                                        KvK-nummer en probeer opnieuw.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {showImportButton && (
                                <RvoConnectCard
                                    b_businessid_farm={b_businessid_farm}
                                    b_id_farm={b_id_farm}
                                    isImporting={isImporting}
                                    isRvoConfigured={isRvoConfigured}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <FarmTitle
                            title="Verwerken van geïmporteerde percelen"
                            description="Controleer de percelen opgehaald vanuit RVO. Deze worden toegevoegd aan uw nieuwe bedrijf."
                        />

                        <FarmContent>
                            <div className="flex flex-col space-y-4 pb-10">
                                <div className="flex justify-end">
                                    <Form
                                        method="post"
                                        action={`/farm/create/${b_id_farm}/${calendar}/rvo`}
                                    >
                                        <input
                                            type="hidden"
                                            name="intent"
                                            value="save_fields"
                                        />
                                        <input
                                            type="hidden"
                                            name="userChoices"
                                            value={JSON.stringify(userChoices)}
                                        />
                                        <input
                                            type="hidden"
                                            name="RvoImportReviewDataJson"
                                            value={JSON.stringify(
                                                RvoImportReviewData,
                                            )}
                                        />
                                        <Button
                                            type="submit"
                                            disabled={isSaving}
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Opslaan...
                                                </>
                                            ) : (
                                                "Opslaan en verder"
                                            )}
                                        </Button>
                                    </Form>
                                </div>
                                <div className="w-full">
                                    <RvoImportReviewTable
                                        data={RvoImportReviewData}
                                        userChoices={userChoices}
                                        onChoiceChange={handleChoiceChange}
                                    />
                                </div>
                            </div>
                        </FarmContent>
                    </>
                )}
            </main>
        </SidebarInset>
    )
}

export async function action({ request, params }: ActionFunctionArgs) {
    const { b_id_farm, calendar: yearString } = params
    if (!b_id_farm || !yearString) {
        throw new Response("b_id_farm and calendar are required", {
            status: 400,
        })
    }
    const year = Number(yearString)
    if (!Number.isInteger(year)) {
        throw new Response("Ongeldig kalenderjaar", { status: 400 })
    }

    const session = await getSession(request)
    const formData = await request.formData()
    const intent = formData.get("intent")

    if (intent === "start_import") {
        const rvoCredentials = getRvoCredentials()
        const isRvoConfigured = rvoCredentials !== undefined

        if (!isRvoConfigured) {
            throw new Response("RVO client is not available", { status: 500 })
        }

        const rvoClient = createConfiguredRvoClient(rvoCredentials)

        const { state, cookieHeader } = await createRvoState(
            b_id_farm,
            request.url,
        )

        const authUrl = generateAuthUrl(rvoClient, state)

        return redirect(authUrl, {
            headers: {
                "Set-Cookie": cookieHeader,
            },
        })
    }

    if (intent === "save_fields") {
        const RvoImportReviewDataJson = formData.get("RvoImportReviewDataJson")
        const userChoicesJson = formData.get("userChoices")

        let RvoImportReviewData: RvoImportReviewItem<any>[] = []
        let userChoices: UserChoiceMap = {}

        if (!RvoImportReviewDataJson || !userChoicesJson) {
            return {
                success: false,
                message:
                    "Geen data gevonden om te verwerken. Start de RVO import opnieuw.",
            }
        }

        try {
            RvoImportReviewData = JSON.parse(String(RvoImportReviewDataJson))
            userChoices = JSON.parse(String(userChoicesJson))

            const onFieldAdded = async (tx: FdmType, b_id: string, geometry: any) => {
                const nmiApiKey = getNmiApiKey()
                if (nmiApiKey) {
                    try {
                        const soilEstimates = await getSoilParameterEstimates(
                            geometry,
                            nmiApiKey,
                        )
                        await addSoilAnalysis(
                            tx,
                            session.principal_id,
                            undefined,
                            "nl-other-nmi",
                            b_id,
                            soilEstimates.a_depth_lower ?? 30,
                            undefined,
                            soilEstimates,
                            soilEstimates.a_depth_upper,
                        )
                    } catch (e) {
                        console.warn(
                            `Failed to fetch soil estimates for field ${b_id}:`,
                            e,
                        )
                    }
                }
            }

            await processRvoImport(
                fdm,
                session.principal_id,
                b_id_farm,
                RvoImportReviewData,
                userChoices,
                year,
                onFieldAdded,
            )
            return redirect(`/farm/create/${b_id_farm}/${yearString}/fields`)
        } catch (e: any) {
            console.error("Error at saving RVO fields: ", e)
            return {
                success: false,
                message: `Error at saving RVO fields: ${await extractErrorMessage(e)}`,
            }
        }
    }

    return {}
}
