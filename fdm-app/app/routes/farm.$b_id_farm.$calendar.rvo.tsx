import {
    type ActionFunctionArgs,
    Form,
    type LoaderFunctionArgs,
    type MetaFunction,
    redirect,
    useActionData,
    useLoaderData,
    useNavigation,
    useParams,
    Link,
    useNavigate,
    useLocation,
} from "react-router"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"
import {
    generateAuthUrl,
    fetchRvoFields,
    compareFields,
    createRvoClient,
    exchangeToken,
} from "~/lib/rvo.server"
import {
    type RvoImportReviewItem,
    RvoImportReviewStatus,
    type UserChoiceMap,
    type ImportReviewAction,
} from "@nmi-agro/fdm-rvo/types"
import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import { processRvoImport } from "@nmi-agro/fdm-rvo"
import { RvoImportReviewTable } from "~/components/blocks/rvo/import-review-table"
import { getFields, getFarm, getFarms } from "@nmi-agro/fdm-core"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "~/components/ui/dialog"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { SidebarInset } from "~/components/ui/sidebar"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { getRvoCredentials } from "../integrations/rvo"
import { RvoErrorAlert } from "~/components/blocks/rvo/rvo-error-alert"
import {
    getNmiApiKey,
    getSoilParameterEstimates,
} from "~/integrations/nmi.server"
import {
    addSoilAnalysis,
    getCultivations,
    getCultivationsFromCatalogue,
} from "@nmi-agro/fdm-core"
import { RvoConnectCard } from "~/components/blocks/rvo/connect-card"
import { clientConfig } from "../lib/config"

export const meta: MetaFunction = ({ params }) => {
    return [{ title: `Percelen ophalen bij RVO - Bedrijf ${params.b_id_farm}` }]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    const { b_id_farm, calendar: yearString } = params
    if (!b_id_farm) {
        throw new Response("Farm ID is required", { status: 400 })
    }
    const year = Number(yearString)

    const session = await getSession(request)
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")

    let rvoImportReviewData: RvoImportReviewItem<any>[] = []
    let error: string | null = null
    let b_businessid_farm: string | null = null
    let b_name_farm: string | null = null

    // Check if RVO is configured
    const rvoCredentials = getRvoCredentials()
    const isRvoConfigured = rvoCredentials !== undefined

    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
    if (farm) {
        b_businessid_farm = farm.b_businessid_farm
        b_name_farm = farm.b_name_farm
    }

    const farms = await getFarms(fdm, session.principal_id)

    if (code && state) {
        try {
            if (!isRvoConfigured) {
                throw new Response("RVO client is not configured.", {
                    status: 500,
                })
            }
            const decodedState = JSON.parse(
                Buffer.from(state, "base64").toString("utf-8"),
            )
            if (decodedState.farmId !== b_id_farm) {
                throw new Response("Invalid state parameter", { status: 403 })
            }

            if (!farm || !farm.b_businessid_farm) {
                throw new Response("b_businessid_farm is not available", {
                    status: 400,
                })
            }

            const rvoClient = createRvoClient(
                rvoCredentials.clientId,
                rvoCredentials.clientName,
                rvoCredentials.redirectUri,
                rvoCredentials.clientSecret,
                process.env.NODE_ENV === "production"
                    ? "production"
                    : "acceptance",
            )
            await exchangeToken(rvoClient, code)

            const rvoFields = await fetchRvoFields(
                rvoClient,
                yearString,
                farm.b_businessid_farm,
            )

            const localFields = await getFields(
                fdm,
                session.principal_id,
                b_id_farm,
            )
            const localFieldsExtended = await Promise.all(
                localFields.map(async (field) => {
                    const cultivations = await getCultivations(
                        fdm,
                        session.principal_id,
                        field.b_id,
                        {
                            start: new Date(`${yearString}-01-01`),
                            end: new Date(`${yearString}-12-31`),
                        },
                    )
                    return { ...field, cultivations }
                }),
            )

            const cultivationsCatalogue = await getCultivationsFromCatalogue(
                fdm,
                session.principal_id,
                b_id_farm,
            )

            rvoImportReviewData = compareFields(
                localFieldsExtended,
                rvoFields,
                year,
                cultivationsCatalogue,
            )
        } catch (e: any) {
            console.error("Error with importing from RVO:", e)
            error = e.message
        }
    } else if (!url.searchParams.has("start_import")) {
        return {
            b_id_farm,
            rvoImportReviewData: [],
            error: null,
            showimportButton: true,
            b_businessid_farm,
            isRvoConfigured,
            farms,
            b_name_farm,
        }
    }

    return {
        b_id_farm,
        rvoImportReviewData,
        error,
        showimportButton: false,
        b_businessid_farm,
        isRvoConfigured,
        farms,
        b_name_farm,
        calendar: yearString,
    }
}

export default function RvoImportReviewPage() {
    const { b_id_farm } = useParams()
    const {
        rvoImportReviewData,
        error,
        b_businessid_farm,
        isRvoConfigured,
        farms,
        calendar,
        showimportButton = false,
    } = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const navigation = useNavigation()
    const location = useLocation()

    const isImporting =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "start_import"
    const isApplying =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "apply_changes"

    const [userChoices, setUserChoices] = useState<UserChoiceMap>({})

    useEffect(() => {
        const initialChoices: UserChoiceMap = {}
        rvoImportReviewData.forEach((item) => {
            const id = getItemId(item)
            let defaultAction: ImportReviewAction = "NO_ACTION"

            switch (item.status) {
                case RvoImportReviewStatus.NEW_REMOTE:
                    defaultAction = "ADD_REMOTE"
                    break
                case RvoImportReviewStatus.NEW_LOCAL:
                    defaultAction = "REMOVE_LOCAL"
                    break
                case RvoImportReviewStatus.EXPIRED_LOCAL:
                    defaultAction = "CLOSE_LOCAL"
                    break
                case RvoImportReviewStatus.CONFLICT:
                    defaultAction = "UPDATE_FROM_REMOTE"
                    break
                case RvoImportReviewStatus.MATCH:
                    defaultAction = "NO_ACTION"
                    break
            }
            initialChoices[id] = defaultAction
        })
        setUserChoices(initialChoices)
    }, [rvoImportReviewData])

    const handleChoiceChange = (id: string, action: ImportReviewAction) => {
        setUserChoices((prev) => ({ ...prev, [id]: action }))
    }

    const currentFarmName =
        farms.find((farm) => farm.b_id_farm === b_id_farm)?.b_name_farm ?? ""

    const changes = Object.values(userChoices).reduce(
        (acc, action) => {
            if (action === "ADD_REMOTE") acc.add++
            if (action === "REMOVE_LOCAL") acc.remove++
            if (action === "UPDATE_FROM_REMOTE") acc.update++
            if (action === "CLOSE_LOCAL") acc.close++
            return acc
        },
        { add: 0, remove: 0, update: 0, close: 0 },
    )
    const hasChanges = Object.values(changes).some((count) => count > 0)

    if (error) {
        return (
            <SidebarInset>
                <Header
                    action={{
                        to: `/farm/${b_id_farm}`,
                        label: "Terug naar bedrijf",
                        disabled: false,
                    }}
                >
                    <HeaderFarm b_id_farm={b_id_farm} farmOptions={farms} />
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="hidden md:block">
                        Percelen ophalen bij RVO
                    </BreadcrumbItem>
                </Header>
                <main>
                    <div className="flex items-center justify-between">
                        <FarmTitle
                            title="Fout bij ophalen percelen bij RVO"
                            description="Er is iets misgegaan bij het ophalen van gegevens."
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
            <Header
                action={{
                    to: `/farm/${b_id_farm}`,
                    label: "Terug naar bedrijf",
                    disabled: false,
                }}
            >
                <HeaderFarm b_id_farm={b_id_farm} farmOptions={farms} />
                <BreadcrumbSeparator />
                <BreadcrumbItem className="hidden md:block">
                    Percelen ophalen bij RVO
                </BreadcrumbItem>
            </Header>
            <main>
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
                                RVO credentials toe te voegen.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                {rvoImportReviewData.length === 0 ? (
                    <div className="mx-auto flex h-full w-full items-center flex-col justify-center space-y-6 sm:w-[600px] py-10">
                        {showimportButton && (
                            <RvoConnectCard
                                b_businessid_farm={b_businessid_farm}
                                b_id_farm={b_id_farm}
                                isImporting={isImporting}
                                isRvoConfigured={isRvoConfigured}
                            />
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between">
                            <FarmTitle
                                title={`Percelen opgehaald bij RVO voor ${currentFarmName}`}
                                description={`Beoordeel de verschillen tussen de percelen in ${clientConfig.name} en bij RVO.`}
                            />
                            <div className="flex items-center gap-4 px-8 pt-6">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button disabled={isApplying}>
                                            {isApplying ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Verwerken...
                                                </>
                                            ) : hasChanges ? (
                                                "Wijzigingen toepassen"
                                            ) : (
                                                "Doorgaan"
                                            )}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>
                                                Wijzigingen toepassen
                                            </DialogTitle>
                                            <DialogDescription>
                                                U staat op het punt de volgende
                                                wijzigingen door te voeren:
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                                {changes.add > 0 && (
                                                    <li>
                                                        {changes.add} perceel
                                                        {changes.add !== 1 &&
                                                            "en"}{" "}
                                                        toevoegen
                                                    </li>
                                                )}
                                                {changes.remove > 0 && (
                                                    <li>
                                                        {changes.remove} perceel
                                                        {changes.remove !== 1 &&
                                                            "en"}{" "}
                                                        verwijderen
                                                    </li>
                                                )}
                                                {changes.update > 0 && (
                                                    <li>
                                                        {changes.update} perceel
                                                        {changes.update !== 1 &&
                                                            "en"}{" "}
                                                        bijwerken
                                                    </li>
                                                )}
                                                {changes.close > 0 && (
                                                    <li>
                                                        {changes.close} perceel
                                                        {changes.close !== 1 &&
                                                            "en"}{" "}
                                                        afsluiten
                                                    </li>
                                                )}
                                            </ul>
                                            {!hasChanges && (
                                                <p>
                                                    Geen wijzigingen
                                                    geselecteerd.
                                                </p>
                                            )}
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button variant="outline">
                                                    Annuleren
                                                </Button>
                                            </DialogClose>
                                            <Form
                                                method="post"
                                                action={`/farm/${b_id_farm}/${calendar}/rvo`}
                                            >
                                                <input
                                                    type="hidden"
                                                    name="intent"
                                                    value="apply_changes"
                                                />
                                                <input
                                                    type="hidden"
                                                    name="userChoices"
                                                    value={JSON.stringify(
                                                        userChoices,
                                                    )}
                                                />
                                                <input
                                                    type="hidden"
                                                    name="rvoImportReviewDataJson"
                                                    value={JSON.stringify(
                                                        rvoImportReviewData,
                                                    )}
                                                />
                                                <Button
                                                    type="submit"
                                                    disabled={isApplying}
                                                >
                                                    Bevestigen
                                                </Button>
                                            </Form>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                        <FarmContent>
                            <div className="flex flex-col space-y-8 pb-10 lg:flex-row lg:space-x-12 lg:space-y-0">
                                <div className="w-full">
                                    <RvoImportReviewTable
                                        data={rvoImportReviewData}
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
        throw new Response("Farm ID is required", { status: 400 })
    }
    const year = Number(yearString)

    const session = await getSession(request)
    const formData = await request.formData()
    const intent = formData.get("intent")

    if (intent === "start_import") {
        const rvoCredentials = getRvoCredentials()
        const isRvoConfigured = rvoCredentials !== undefined

        if (!isRvoConfigured) {
            throw new Response("RVO client is not configured.", { status: 500 })
        }

        const rvoClient = createRvoClient(
            rvoCredentials.clientId,
            rvoCredentials.clientName,
            rvoCredentials.redirectUri,
            rvoCredentials.clientSecret,
            process.env.NODE_ENV === "production" ? "production" : "acceptance",
        )
        const state = Buffer.from(
            JSON.stringify({ farmId: b_id_farm, returnUrl: request.url }),
        ).toString("base64")
        const authUrl = generateAuthUrl(rvoClient, state)
        return redirect(authUrl)
    }

    if (intent === "apply_changes") {
        const rvoImportReviewDataJson = formData.get("rvoImportReviewDataJson")
        const userChoicesJson = formData.get("userChoices")

        let rvoImportReviewData: RvoImportReviewItem<any>[] = []
        let userChoices: UserChoiceMap = {}

        if (!rvoImportReviewDataJson || !userChoicesJson) {
            return {
                success: false,
                message:
                    "Geen data gevonden om te verwerken. Start 'percelen ophalen bij RVO' opnieuw.",
            }
        }

        try {
            rvoImportReviewData = JSON.parse(String(rvoImportReviewDataJson))
            userChoices = JSON.parse(String(userChoicesJson))

            const onFieldAdded = async (b_id: string, geometry: any) => {
                const nmiApiKey = getNmiApiKey()
                if (nmiApiKey) {
                    try {
                        const soilEstimates = await getSoilParameterEstimates(
                            geometry,
                            nmiApiKey,
                        )
                        await addSoilAnalysis(
                            fdm,
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
                rvoImportReviewData,
                userChoices,
                year,
                onFieldAdded,
            )
            return redirect(`/farm/${b_id_farm}`)
        } catch (e: any) {
            console.error("Error with processing RVO import: ", e)
            return {
                success: false,
                message: `Error with processing RVO import:  ${e.message}`,
            }
        }
    }

    return {}
}
