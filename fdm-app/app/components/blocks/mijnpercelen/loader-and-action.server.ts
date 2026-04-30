import fs from "node:fs/promises"
import {
    addSoilAnalysis,
    determineIfFieldIsBuffer,
    type Field,
    getCultivationsForFarm,
    getCultivationsFromCatalogue,
    getFarm,
    getFields,
    updateField,
} from "@nmi-agro/fdm-core"
import type {
    RvoImportReviewItem,
    UserChoiceMap,
} from "@nmi-agro/fdm-rvo/types"
import { createFsFileStorage } from "@remix-run/file-storage/fs"
import { type FileUpload, parseFormData } from "@remix-run/form-data-parser"
import area from "@turf/area"
import { lineString } from "@turf/helpers"
import { length } from "@turf/length"
import type { MultiPolygon, Polygon } from "geojson"
import type { MetaFunction } from "react-router"
import { data } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import {
    getNmiApiKey,
    getSoilParameterEstimates,
} from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { extractErrorMessage, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
    compareFields,
    getItemId,
    getRvoFieldsFromShapefile,
    processRvoImport,
    RvoImportReviewStatus,
} from "~/lib/rvo.server"

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

interface MijnPercelenUploadServerContext {
    request: Request
    params: {
        b_id_farm: string
        calendar: string
    }
}
export async function loader({
    request,
    params,
}: MijnPercelenUploadServerContext) {
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

export async function genericAction(
    { request, params }: MijnPercelenUploadServerContext,
    returnUrl: string,
): Promise<
    | Response
    | {
          success?: boolean
          message?: string
          RvoImportReviewData?: RvoImportReviewItem<Field>[]
      }
> {
    const storageKeys: string[] = []
    const uploadRequestId = crypto.randomUUID()
    const fileStorage = createFsFileStorage(
        `./uploads/shapefiles/${uploadRequestId}`,
    )
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
            const allCultivations = await getCultivationsForFarm(
                fdm,
                session.principal_id,
                b_id_farm,
            )
            const fieldsExtended = fields.map((field) => ({
                ...field,
                cultivations: allCultivations.get(field.b_id) ?? [],
            }))
            const cultivationsCatalogue = await getCultivationsFromCatalogue(
                fdm,
                session.principal_id,
                b_id_farm,
            )

            const files = formData
                .getAll("shapefile")
                .filter((entry): entry is File => entry instanceof File)

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

            /** Calculates the perimeter of the given polygon geometry in meters */
            function perimeter(geometry: Polygon | MultiPolygon) {
                if (geometry.type === "Polygon") {
                    return length(lineString(geometry.coordinates[0]), {
                        units: "meters",
                    })
                }
                if (geometry.type === "MultiPolygon") {
                    return geometry.coordinates
                        .map((polygon) =>
                            length(lineString(polygon[0]), { units: "meters" }),
                        )
                        .reduce((a, b) => a + b, 0)
                }
                return 0
            }

            const RvoImportReviewData = compareFields(
                fieldsExtended,
                rvoFields,
                year,
                cultivationsCatalogue,
            )

            // Determine if any imported field might be a buffer strip and add it since shapefiles don't have this information
            for (const item of rvoFields) {
                item.properties.mestData = {
                    IndBufferstrook: determineIfFieldIsBuffer(
                        area(item.geometry) / 10000, // m2 to ha
                        perimeter(item.geometry), // already in meters
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
                message: "Percelen zijn klaar voor beoordeling! 🎉",
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
                        "Geen data gevonden om te verwerken. Start de shapefile import opnieuw.",
                    RvoImportReviewData: undefined,
                }
            }

            rvoImportReviewData = JSON.parse(String(RvoImportReviewDataJson))
            userChoices = JSON.parse(String(userChoicesJson))

            if (!Array.isArray(rvoImportReviewData)) {
                throw new Error("Invalid review data format")
            }

            if (!(userChoices instanceof Object)) {
                throw new Error("Invalid user choices format")
            }

            const addedFields: { b_id: string; geometry: any }[] = []
            await fdm.transaction(async (tx) => {
                await processRvoImport(
                    tx,
                    session.principal_id,
                    b_id_farm,
                    rvoImportReviewData,
                    userChoices,
                    year,
                    (_tx, b_id, geometry) => {
                        // Do this synchronously
                        addedFields.push({ b_id, geometry })
                        return Promise.resolve()
                    },
                )

                // Override field properties for columns that are always "updated from RVO"
                for (const item of rvoImportReviewData) {
                    // Get the user choice to determine if there is a field to update
                    const choice = userChoices[getItemId(item)]
                    if (
                        choice !== "REMOVE_LOCAL" &&
                        item.localField &&
                        item.rvoField?.properties.mestData &&
                        (item.rvoField.properties.mestData.IndBufferstrook ===
                            "J") !==
                            item.localField.b_bufferstrip
                    ) {
                        await updateField(
                            tx,
                            session.principal_id,
                            item.localField.b_id,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            item.rvoField.properties.mestData
                                .IndBufferstrook === "J", // b_bufferstrip
                        )
                    }
                }
            })

            const nmiApiKey = getNmiApiKey()
            if (nmiApiKey) {
                for (const { b_id, geometry } of addedFields) {
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

            return redirectWithSuccess(
                returnUrl,
                "Percelen zijn succesvol geïmporteerd! 🎉",
            )
        }

        return {}
    } catch (e: any) {
        console.error("Error at saving RVO fields: ", e)
        return {
            success: false,
            message: `Error at saving RVO fields: ${await extractErrorMessage(e)}`,
        }
    } finally {
        await Promise.allSettled(
            storageKeys.map((storageKey) => fileStorage.remove(storageKey)),
        )
        await fs
            .rm(`./uploads/shapefiles/${uploadRequestId}`, {
                recursive: true,
                force: true,
            })
            .catch((err: unknown) => {
                reportError(err, {
                    uploadRequestId: uploadRequestId,
                })
            })
    }
}
