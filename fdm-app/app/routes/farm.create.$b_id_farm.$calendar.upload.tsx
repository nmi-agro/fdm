import {
    addSoilAnalysis,
    determineIfFieldIsBuffer,
    type FdmType,
    type Field,
    getCultivations,
    getCultivationsFromCatalogue,
    getFarm,
    getFields,
    updateField,
} from "@nmi-agro/fdm-core"
import type {
    ImportReviewAction,
    RvoImportReviewItem,
    UserChoiceMap,
} from "@nmi-agro/fdm-rvo/types"
import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import { createFsFileStorage } from "@remix-run/file-storage/fs"
import { type FileUpload, parseFormData } from "@remix-run/form-data-parser"
import area from "@turf/area"
import { lineString } from "@turf/helpers"
import { length } from "@turf/length"
import type { MultiPolygon, Polygon } from "geojson"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import type {
    ActionFunctionArgs,
    LoaderFunctionArgs,
    MetaFunction,
} from "react-router"
import {
    data,
    Form,
    redirect,
    useActionData,
    useLoaderData,
    useLocation,
    useNavigation,
} from "react-router"
import { toast } from "sonner"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { MijnPercelenUploadForm } from "~/components/blocks/mijnpercelen/form-upload"
import { RvoImportReviewTable } from "~/components/blocks/rvo/import-review-table"
import { Button } from "~/components/ui/button"
import { SidebarInset } from "~/components/ui/sidebar"
import {
    getNmiApiKey,
    getSoilParameterEstimates,
} from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { extractErrorMessage } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
    compareFields,
    getRvoFieldsFromShapefile,
    processRvoImport,
    RvoImportReviewStatus,
} from "~/lib/rvo.server"
import { cn } from "~/lib/utils"

export const handle = { hideNavigationProgress: true }

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Shapefile uploaden - Bedrijf toevoegen | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Upload een shapefile om percelen te importeren.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    // Get the Id and name of the farm
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
        throw data("Farm ID is required", {
            status: 400,
            statusText: "Farm ID is required",
        })
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

    const calendar = getCalendar(params)

    return { b_id_farm, b_name_farm: farm.b_name_farm, calendar }
}

export default function UploadMijnPercelenPage() {
    const { b_id_farm, calendar, b_name_farm } = useLoaderData<typeof loader>()
    const navigation = useNavigation()
    const location = useLocation()

    const [rvoImportReviewData, setRvoImportReviewData] = useState<
        RvoImportReviewItem<any>[] | null
    >()
    const [userChoices, setUserChoices] = useState<UserChoiceMap>({})

    const actionData = useActionData<typeof action>()

    const handleItemChange = (id: string, item: RvoImportReviewItem<any>) => {
        // Note: there is the assumption that getItemId will keep returning the same id.
        // Therefore, make sure that `item` doesn't have a different rvoField id and localField id.
        setRvoImportReviewData((data) => {
            if (!data) return
            const index = data.findIndex(
                (originalItem) => getItemId(originalItem) === id,
            )
            if (index === -1) {
                console.warn(
                    `Item with id ${id} not found so nothing is modified.`,
                )
                return
            }
            const newData = [...data]
            newData[index] = item
            return newData
        })
    }

    const handleChoiceChange = (id: string, action: ImportReviewAction) => {
        setUserChoices((prev: UserChoiceMap) => ({ ...prev, [id]: action }))
    }

    const actionRvoImportReviewData = actionData?.RvoImportReviewData

    const isSaving =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "save_fields"

    useEffect(() => {
        if (actionRvoImportReviewData) {
            setRvoImportReviewData((oldData) => {
                if (!oldData) {
                    window.location.hash = "#review"
                }
                return actionRvoImportReviewData
            })

            // Initialize user choices with defaults
            const initialChoices: UserChoiceMap = {}
            actionRvoImportReviewData.forEach((item) => {
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
        }
    }, [actionRvoImportReviewData])

    useEffect(() => {
        if (typeof window === "undefined") return
        function onHashChange(event: HashChangeEvent) {
            if (new URL(event.newURL).hash === "") {
                event.preventDefault()
                window.location.href = window.location.href.toString()
            }
        }
        window.addEventListener(
            "hashchange",
            onHashChange as unknown as (_: Event) => void,
        )
        return () =>
            window.removeEventListener(
                "hashchange",
                onHashChange as unknown as (_: Event) => void,
            )
    })

    // Show alerts
    useEffect(() => {
        if (actionData?.message) {
            if (actionData.success) {
                toast.success(actionData.message)
            } else {
                toast.error(actionData.message)
            }
        }
    }, [actionData])

    // Warn the user before refreshing or leaving when data is present
    const expectedRedirectPath = `/farm/create/${b_id_farm}/${calendar}/fields`
    useEffect(() => {
        if (rvoImportReviewData && rvoImportReviewData.length > 0) {
            const handleBeforeUnload = (e: BeforeUnloadEvent) => {
                if (typeof window !== "undefined") {
                    if (window.location.hash === "") {
                        // Run out of the current call stack so the browser doesn't intercept it
                        setTimeout(() => (window.location.hash = "#upload"))
                    }
                }
                if (location.pathname.startsWith(expectedRedirectPath)) return
                e.preventDefault()
                e.returnValue =
                    "Als u de pagina ververst, wordt de verbinding met RVO verbroken en moet u opnieuw inloggen met eHerkenning. Wilt u doorgaan?"
                return e.returnValue
            }
            window.addEventListener("beforeunload", handleBeforeUnload)
            return () =>
                window.removeEventListener("beforeunload", handleBeforeUnload)
        }
    }, [location.pathname, expectedRedirectPath, rvoImportReviewData])

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarmCreate b_name_farm={b_name_farm} />
            </Header>
            <main className="flex-1 overflow-auto">
                {!rvoImportReviewData ? (
                    <div className="flex h-screen items-center justify-center">
                        <MijnPercelenUploadForm
                            b_id_farm={b_id_farm}
                            calendar={calendar}
                        />
                    </div>
                ) : (
                    <>
                        <FarmTitle
                            title="Verwerken van geïmporteerde percelen"
                            description="Controleer de percelen die zijn geïmporteerd vanuit het Shapefile. Deze worden toegevoegd aan uw nieuwe bedrijf."
                        />
                        <FarmContent>
                            <div className="flex flex-col space-y-4 pb-10">
                                <Form method="post">
                                    <div className="flex justify-end gap-2">
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
                                                rvoImportReviewData,
                                            )}
                                        />

                                        <Button
                                            asChild
                                            variant="outline"
                                            className={cn(
                                                isSaving && "opacity-50",
                                            )}
                                        >
                                            {/* Vanilla anchor triggers refresh behavior */}
                                            <a
                                                href={location.pathname}
                                                onClick={(e) => {
                                                    if (isSaving)
                                                        e.preventDefault()
                                                }}
                                            >
                                                Terug naar uploaden
                                            </a>
                                        </Button>

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
                                    </div>
                                </Form>
                                <div className="w-full">
                                    <RvoImportReviewTable
                                        data={rvoImportReviewData}
                                        userChoices={userChoices}
                                        flags={{
                                            b_bufferstrip_info_available: false,
                                        }}
                                        onItemChange={handleItemChange}
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

export async function action({ request, params }: ActionFunctionArgs): Promise<
    | Response
    | {
          success?: boolean
          message?: string
          RvoImportReviewData?: RvoImportReviewItem<Field>[]
      }
> {
    const storageKeys: string[] = []
    const fileStorage = createFsFileStorage("./uploads/shapefiles")
    try {
        const { b_id_farm, calendar: yearString } = params
        if (!b_id_farm || !yearString) {
            throw data(
                {
                    message: "b_id_farm and calendar are required",
                    success: false,
                },
                {
                    status: 400,
                },
            )
        }
        const year = Number(yearString)
        if (!Number.isInteger(year)) {
            throw data(
                { message: "Ongeldig kalenderjaar", success: false },
                { status: 400 },
            )
        }

        const session = await getSession(request)

        // Parse form data with streaming
        const uploadHandler = async (fileUpload: FileUpload) => {
            const storageKey = crypto.randomUUID()
            storageKeys.push(storageKey)
            await fileStorage.set(storageKey, fileUpload)
            const file = await fileStorage.get(storageKey)
            if (file && "toFile" in file && typeof file.toFile === "function") {
                return (file as unknown as { toFile: () => File }).toFile()
            }
            return file
        }
        const formData = await parseFormData(
            request,
            { maxFileSize: 5 * 1024 * 1024 },
            uploadHandler,
        )
        const intent = formData.get("intent")

        if (intent === "upload") {
            // Prepare existing fields for comparison
            const fields = await getFields(fdm, session.principal_id, b_id_farm)
            const fieldsExtended = await Promise.all(
                fields.map(async (field) => ({
                    ...field,
                    cultivations: await getCultivations(
                        fdm,
                        session.principal_id,
                        field.b_id,
                    ),
                })),
            )
            const cultivationsCatalogue = await getCultivationsFromCatalogue(
                fdm,
                session.principal_id,
                b_id_farm,
            )

            const files = formData.getAll("shapefile") as File[]

            const shp_file = files.find((f) => f.name.endsWith(".shp"))
            const shx_file = files.find((f) => f.name.endsWith(".shx"))
            const dbf_file = files.find((f) => f.name.endsWith(".dbf"))
            const prj_file = files.find((f) => f.name.endsWith(".prj"))

            if (!shp_file || !shx_file || !dbf_file || !prj_file) {
                const message =
                    "Een .shp, .shx, .dbf en .prj bestand zijn verplicht."
                return {
                    message: message,
                    success: false,
                    RvoImportReviewData: undefined,
                }
            }

            const rvoFields = await getRvoFieldsFromShapefile(
                shp_file,
                shx_file,
                dbf_file,
                prj_file,
            )

            function perimeter(geometry: Polygon | MultiPolygon) {
                if (geometry.type === "Polygon") {
                    return geometry.coordinates
                        .map((ring) => length(lineString(ring)))
                        .reduce((a, b) => a + b)
                }
                if (geometry.type === "MultiPolygon") {
                    return geometry.coordinates
                        .flatMap((polygon) =>
                            polygon.flatMap((ring) => length(lineString(ring))),
                        )
                        .reduce((a, b) => a + b)
                }
                return 0
            }

            const RvoImportReviewData = compareFields(
                fieldsExtended,
                rvoFields,
                year,
                cultivationsCatalogue,
            )

            // Determine if any imported field might be a buffer strip and add it since Shapefiles don't have this information
            for (const item of rvoFields) {
                item.properties.mestData = {
                    IndBufferstrook: determineIfFieldIsBuffer(
                        area(item.geometry),
                        perimeter(item.geometry),
                        item.properties.CropFieldDesignator,
                    )
                        ? "J"
                        : "N",
                }
            }

            // Override each local field's corresponding RVO field buffer strip status
            for (const item of RvoImportReviewData) {
                item.diffs = item.diffs.filter(
                    (diff) => diff !== "b_bufferstrip",
                )
                // b_bufferstrip should no longer be considered a difference
                if (
                    item.diffs.length === 0 &&
                    item.status === RvoImportReviewStatus.CONFLICT
                ) {
                    item.status = RvoImportReviewStatus.MATCH
                }
                if (item.localField && item.rvoField?.properties.mestData) {
                    item.rvoField.properties.mestData.IndBufferstrook = item
                        .localField.b_bufferstrip
                        ? "J"
                        : "N"
                }
            }

            return {
                RvoImportReviewData: RvoImportReviewData,
                message: "Percelen zijn klaar voor beeordeling! 🎉",
                success: true,
            }
        }

        if (intent === "save_fields") {
            const RvoImportReviewDataJson = formData.get(
                "RvoImportReviewDataJson",
            )
            const userChoicesJson = formData.get("userChoices")

            let rvoImportReviewData: RvoImportReviewItem<any>[] = []
            let userChoices: UserChoiceMap = {}

            if (!RvoImportReviewDataJson || !userChoicesJson) {
                return {
                    success: false,
                    message:
                        "Geen data gevonden om te verwerken. Start de RVO import opnieuw.",
                    RvoImportReviewData: undefined,
                }
            }

            rvoImportReviewData = JSON.parse(String(RvoImportReviewDataJson))
            userChoices = JSON.parse(String(userChoicesJson))

            if (!Array.isArray(rvoImportReviewData)) {
                throw new Error("Invalid review data format")
            }

            const onFieldAdded = async (
                tx: FdmType,
                b_id: string,
                geometry: any,
            ) => {
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
                rvoImportReviewData,
                userChoices,
                year,
                onFieldAdded,
            )

            // Override field properties for columns that are always "updated from RVO"
            for (const item of rvoImportReviewData) {
                if (item.localField && item.rvoField?.properties.mestData) {
                    await updateField(
                        fdm,
                        session.principal_id,
                        item.localField.b_id,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        item.rvoField.properties.mestData.IndBufferstrook ===
                            "J", // b_bufferstrip
                    )
                }
            }
            return redirect(`/farm/create/${b_id_farm}/${yearString}/fields`)
        }

        return {}
    } catch (e: any) {
        console.error("Error at saving RVO fields: ", e)
        return {
            success: false,
            message: `Error at saving RVO fields: ${await extractErrorMessage(e)}`,
        }
    } finally {
        for (const storageKey of storageKeys) {
            fileStorage.remove(storageKey)
        }
    }
}
