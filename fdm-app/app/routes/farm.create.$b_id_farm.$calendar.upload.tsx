import {
    addCultivation,
    addField,
    addSoilAnalysis,
    getDefaultDatesOfCultivation,
    getFarm,
} from "@nmi-agro/fdm-core"
import { createFsFileStorage } from "@remix-run/file-storage/fs"
import { type FileUpload, parseFormData } from "@remix-run/form-data-parser"
import * as turf from "@turf/turf"
import type { Feature, FeatureCollection, Polygon } from "geojson"
import proj4 from "proj4"
import type {
    ActionFunctionArgs,
    LoaderFunctionArgs,
    MetaFunction,
} from "react-router"
import { data, useLoaderData } from "react-router"
import { dataWithWarning, redirectWithSuccess } from "remix-toast"
import { combine, parseDbf, parseShp } from "shpjs"
import { MijnPercelenUploadForm } from "@/app/components/blocks/mijnpercelen/form-upload"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { SidebarInset } from "~/components/ui/sidebar"
import { getNmiApiKey, getSoilParameterEstimates } from "~/integrations/nmi"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

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

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarmCreate b_name_farm={b_name_farm} />
            </Header>
            <main>
                <div className="flex h-screen items-center justify-center">
                    <MijnPercelenUploadForm
                        b_id_farm={b_id_farm}
                        calendar={calendar}
                    />
                </div>
            </main>
        </SidebarInset>
    )
}

interface RvoProperties {
    SECTORID: string
    SECTORVER: number
    NEN3610ID: string
    VOLGNR: number
    NAAM: string | null | undefined
    BEGINDAT: number
    EINDDAT: number
    GEWASCODE: string
    GEWASOMSCH: string
    TITEL: string
    TITELOMSCH: string
}

export async function action({ request, params }: ActionFunctionArgs) {
    const fileStorage = createFsFileStorage("./uploads/shapefiles")
    const storageKeys: string[] = []

    try {
        // Get the Id and name of the farm
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        const session = await getSession(request)
        const calendar = await getCalendar(params)
        const nmiApiKey = getNmiApiKey()

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
        const files = formData.getAll("shapefile") as File[]

        const shp_file = files.find((f) => f.name.endsWith(".shp"))
        const shx_file = files.find((f) => f.name.endsWith(".shx"))
        const dbf_file = files.find((f) => f.name.endsWith(".dbf"))
        const prj_file = files.find((f) => f.name.endsWith(".prj"))

        if (!shp_file || !shx_file || !dbf_file || !prj_file) {
            return dataWithWarning(
                {},
                "Een .shp, .shx, .dbf en .prj bestand zijn verplicht.",
            )
        }

        const shpBuffer = await shp_file.arrayBuffer()
        const shxBuffer = await shx_file.arrayBuffer()
        const dbfBuffer = await dbf_file.arrayBuffer()
        const prj_text = await prj_file.text()

        let shapefile: FeatureCollection<Polygon, RvoProperties>
        try {
            shapefile = (await combine([
                parseShp(shpBuffer, shxBuffer),
                parseDbf(dbfBuffer),
            ])) as FeatureCollection<Polygon, RvoProperties>
        } catch (_error) {
            return dataWithWarning({}, "Shapefile is ongeldig.")
        }

        if (shapefile.features.length === 0) {
            return dataWithWarning({}, "Shapefile bevat geen percelen.")
        }

        const source_proj = prj_text
        const dest_proj = "EPSG:4326"

        const converter = proj4(source_proj, dest_proj)

        const features = shapefile.features.map(
            (feature: Feature<Polygon, RvoProperties>) => {
                const new_coords = feature.geometry.coordinates.map(
                    (ring: number[][]) => {
                        return ring.map((coord: number[]) => {
                            return converter.forward(coord)
                        })
                    },
                )
                feature.geometry.coordinates = new_coords
                return feature
            },
        )

        let unnamedCount = 0
        for (const feature of features) {
            const { properties, geometry } = feature
            const {
                SECTORID,
                SECTORVER,
                NEN3610ID,
                VOLGNR,
                NAAM,
                BEGINDAT,
                EINDDAT,
                GEWASCODE,
                GEWASOMSCH,
                TITEL,
                TITELOMSCH,
            } = properties

            if (
                !SECTORID ||
                !SECTORVER ||
                !NEN3610ID ||
                !VOLGNR ||
                NAAM === undefined ||
                !BEGINDAT ||
                !EINDDAT ||
                !GEWASCODE ||
                !GEWASOMSCH ||
                !TITEL ||
                !TITELOMSCH
            ) {
                return dataWithWarning(
                    {},
                    "De shapefile bevat niet de vereiste RVO attributen.",
                )
            }

            const b_geometry = turf.polygon(geometry.coordinates)
            const b_name = NAAM?.trim() ?? `Naamloos perceel ${++unnamedCount}`
            const b_start = new Date(BEGINDAT)
            const b_end = EINDDAT === 253402297199 ? null : new Date(EINDDAT)
            const b_lu_catalogue = `nl_${GEWASCODE}`
            const b_acquiring_method = `nl_${TITEL}`
            const b_id_source = SECTORID

            const fieldId = await addField(
                fdm,
                session.principal_id,
                b_id_farm,
                b_name,
                b_id_source,
                b_geometry.geometry,
                b_start,
                b_acquiring_method,
                b_end,
            )

            const cultivationDefaultDates = await getDefaultDatesOfCultivation(
                fdm,
                session.principal_id,
                b_id_farm,
                b_lu_catalogue,
                Number(calendar),
            )
            const b_lu_start = cultivationDefaultDates.b_lu_start
            const b_lu_end = cultivationDefaultDates.b_lu_end
            await addCultivation(
                fdm,
                session.principal_id,
                b_lu_catalogue,
                fieldId,
                b_lu_start,
                b_lu_end,
            )

            if (nmiApiKey) {
                const estimates = await getSoilParameterEstimates(
                    b_geometry,
                    nmiApiKey,
                )

                await addSoilAnalysis(
                    fdm,
                    session.principal_id,
                    undefined,
                    estimates.a_source,
                    fieldId,
                    estimates.a_depth_lower,
                    undefined,
                    estimates,
                )
            }
        }

        return redirectWithSuccess(
            `/farm/create/${b_id_farm}/${calendar}/fields`,
            {
                message: "Percelen zijn succesvol geïmporteerd! 🎉",
            },
        )
    } catch (error) {
        throw handleActionError(error)
    } finally {
        for (const key of storageKeys) {
            await fileStorage.remove(key)
        }
    }
}
