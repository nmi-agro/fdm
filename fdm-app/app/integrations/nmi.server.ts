import centroid from "@turf/centroid"
import { fileTypeFromBuffer } from "file-type"
import type { Feature, Geometry, Polygon } from "geojson"
import proj4 from "proj4"
import { z } from "zod"
import { serverConfig } from "~/lib/config.server"

const MAX_PDF_SIZE = 5 * 1024 * 1024

// Register the projection for RD New (EPSG:28992)
if (!proj4.defs("EPSG:28992")) {
    proj4.defs(
        "EPSG:28992",
        "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +units=m +no_defs",
    )
}

export function getNmiApiKey() {
    if (!serverConfig.integrations.nmi) {
        return undefined
    }

    const nmiApiKey = serverConfig.integrations.nmi.api_key
    return nmiApiKey
}

async function validatePdfMagicBytes(file: File) {
    if (file.size > MAX_PDF_SIZE) {
        throw new Error(`invalid: Bestand "${file.name}" is groter dan 5MB.`)
    }
    const buffer = await file.arrayBuffer()
    const type = await fileTypeFromBuffer(Buffer.from(buffer))
    if (!type || type.ext !== "pdf" || type.mime !== "application/pdf") {
        throw new Error(
            `invalid: Bestand "${file.name}" is geen geldig PDF-bestand.`,
        )
    }
}

export async function getSoilParameterEstimates(
    field: Feature | Polygon,
    nmiApiKey: string | undefined,
): Promise<{
    a_al_ox: number
    a_c_of: number
    a_ca_co: number
    a_ca_co_po: number
    a_caco3_if: number
    a_cec_co: number
    a_clay_mi: number
    a_cn_fr: number
    a_com_fr: number
    a_cu_cc: number
    a_density_sa: number
    a_fe_ox: number
    a_k_cc: number
    a_k_co: number
    a_k_co_po: number
    a_mg_cc: number
    a_mg_co: number
    a_mg_co_po: number
    a_n_pmn: number
    a_n_rt: number
    a_p_al: number
    a_p_cc: number
    a_p_ox: number
    a_p_rt: number
    a_p_sg: number
    a_p_wa: number
    a_ph_cc: number
    a_s_rt: number
    a_sand_mi: number
    a_silt_mi: number
    a_som_loi: number
    a_zn_cc: number
    b_soiltype_agr: string
    b_gwl_class: string
    b_gwl_ghg: number
    b_gwl_glg: number
    b_c_st03: number
    b_som_potential: number
    b_c_st03_potential: number
    b_c_delta: number
    cultivations: { year: number; b_lu_brp: number }[]
    cultivations_advanced: {
        year: number
        fields: {
            b_lu_brp: number
            b_area: number
            b_area_overlap: number
        }[]
    }[]
    a_source: string
    a_depth_upper: number
    a_depth_lower: number | undefined
}> {
    if (!nmiApiKey) {
        throw new Error("Please provide a NMI API key")
    }

    let geometry: Geometry
    if ("geometry" in field) {
        geometry = field.geometry
    } else {
        geometry = field
    }
    const fieldCentroid = centroid(geometry)
    const a_lon = fieldCentroid.geometry.coordinates[0]
    const a_lat = fieldCentroid.geometry.coordinates[1]

    const responseApi = await fetch(
        `https://api.nmi-agro.nl/estimates?${new URLSearchParams({
            a_lat: a_lat.toString(),
            a_lon: a_lon.toString(),
        })}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${nmiApiKey}`,
            },
        },
    )

    if (!responseApi.ok) {
        throw new Error("Request to NMI API failed")
    }

    const result = await responseApi.json()
    const response = result.data
    response.a_source = "nl-other-nmi"
    response.a_depth_upper = 0
    response.a_depth_lower = undefined

    // Validate the response using the Zod schema
    const parsedResponse = soilParameterEstimatesSchema.safeParse(result.data)
    if (!parsedResponse.success) {
        console.error(
            "NMI API response validation failed:",
            JSON.stringify(z.treeifyError(parsedResponse.error), null, 2),
        )
        throw new Error(
            `Invalid response from NMI API: ${parsedResponse.error.message}`,
        )
    }

    return response
}

const soilParameterEstimatesSchema = z.object({
    a_al_ox: z.number(),
    a_ca_co: z.number(),
    a_ca_co_po: z.number(),
    a_caco3_if: z.number(),
    a_cec_co: z.number(),
    a_clay_mi: z.number(),
    a_cn_fr: z.number(),
    a_com_fr: z.number(),
    a_cu_cc: z.number(),
    a_fe_ox: z.number(),
    a_k_cc: z.number(),
    a_k_co: z.number(),
    a_k_co_po: z.number(),
    a_mg_cc: z.number(),
    a_mg_co: z.number(),
    a_mg_co_po: z.number(),
    a_n_pmn: z.number(),
    a_n_rt: z.number(),
    a_p_al: z.number(),
    a_p_cc: z.number(),
    a_p_ox: z.number(),
    a_p_rt: z.number(),
    a_p_sg: z.number(),
    a_p_wa: z.number(),
    a_ph_cc: z.number(),
    a_s_rt: z.number(),
    a_sand_mi: z.number(),
    a_silt_mi: z.number(),
    a_som_loi: z.number(),
    a_zn_cc: z.number(),
    b_soiltype_agr: z.string(),
    b_gwl_class: z.string(),
    b_gwl_ghg: z.number(),
    b_gwl_glg: z.number(),
    b_c_st03: z.number(),
    b_som_potential: z.number(),
    b_c_st03_potential: z.number(),
    b_c_delta: z.number(),
    cultivations: z.array(z.object({ year: z.number(), b_lu_brp: z.number() })),
    cultivations_advanced: z.array(
        z.object({
            year: z.number(),
            fields: z.array(
                z.object({
                    b_lu_brp: z.number(),
                    b_area: z.number(),
                    b_area_overlap: z.number(),
                }),
            ),
        }),
    ),
    a_source: z.string(),
})

export async function extractSoilAnalysis(formData: FormData) {
    const nmiApiKey = getNmiApiKey()

    if (!nmiApiKey) {
        throw new Error("NMI API key not configured")
    }

    // Validate that FormData contains a file
    const file = formData.get("soilAnalysisFile") as File
    if (!file || !(file instanceof File)) {
        throw new Error("No file provided in FormData")
    }

    await validatePdfMagicBytes(file)

    const responseApi = await fetch("https://api.nmi-agro.nl/soilreader", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${nmiApiKey}`,
        },
        body: formData,
    })

    if (!responseApi.ok) {
        throw new Error("Request to NMI API failed")
    }

    const result = await responseApi.json()
    const response = result.data

    // Validate response structure
    if (
        !response.fields ||
        !Array.isArray(response.fields) ||
        response.fields.length === 0
    ) {
        throw new Error("Invalid API response: no fields found")
    }

    // Process the response
    const field = response.fields[0]

    // Select the a_* parameters
    const soilAnalysis: {
        [key: string]: string | number | Date | any
        location?: { type: "Point"; coordinates: [number, number] }
    } = {}
    soilAnalysis.b_name = field.b_fieldname // Map b_fieldname for name matching
    for (const key of Object.keys(field).filter((key) =>
        key.startsWith("a_"),
    )) {
        soilAnalysis[key] = field[key]
    }

    // Check if soil parameters are returned
    if (!soilAnalysis.a_source) {
        throw new Error("Invalid soil analysis: laboratory source missing")
    }

    // Process the other parameters
    if (field.b_date) {
        // As b_date is in format dd-mm-yyyy
        const dateParts = field.b_date.split("-")
        if (dateParts.length === 3) {
            const day = Number.parseInt(dateParts[0], 10)
            const month = Number.parseInt(dateParts[1], 10) - 1 // Month is 0-indexed
            const year = Number.parseInt(dateParts[2], 10)

            if (
                !Number.isNaN(day) &&
                !Number.isNaN(month) &&
                !Number.isNaN(year)
            ) {
                soilAnalysis.b_sampling_date = new Date(year, month, day)
            }
        }
    }
    if (field.b_soiltype_agr) {
        soilAnalysis.b_soil_type = field.b_soiltype_agr
    }
    if (field.b_depth) {
        const depthParts = field.b_depth.split("-")
        if (depthParts.length !== 2) {
            throw new Error(`Invalid depth format: ${field.b_depth}`)
        }
        soilAnalysis.a_depth_upper = Number(depthParts[0]) as number
        soilAnalysis.a_depth_lower = Number(depthParts[1]) as number
        // Validate that the conversion to numbers was successful
        if (
            Number.isNaN(soilAnalysis.a_depth_upper) ||
            Number.isNaN(soilAnalysis.a_depth_lower)
        ) {
            throw new Error(`Invalid numeric depth values: ${field.b_depth}`)
        }
    }

    // Add coordinates for geometry matching
    const x_rd = field.b_loc_x
    const y_rd = field.b_loc_y

    if (x_rd && y_rd) {
        const numericX = Number(x_rd)
        const numericY = Number(y_rd)

        if (!Number.isNaN(numericX) && !Number.isNaN(numericY)) {
            try {
                const [lon, lat] = proj4("EPSG:28992", "EPSG:4326", [
                    numericX,
                    numericY,
                ])
                soilAnalysis.location = {
                    type: "Point",
                    coordinates: [lon, lat],
                }
            } catch (e) {
                console.error("Coordinate transformation failed:", e)
            }
        }
    }

    return soilAnalysis
}

export async function extractBulkSoilAnalyses(formData: FormData) {
    const nmiApiKey = getNmiApiKey()

    if (!nmiApiKey) {
        throw new Error("NMI API key not configured")
    }

    // Filter out potential non-File objects or empty slots
    const files = formData.getAll("soilAnalysisFile") as File[]
    const validFiles = files.filter((file) => file instanceof File && file.name)
    if (validFiles.length === 0) {
        throw new Error("Geen geldige bestanden gevonden in FormData")
    }

    for (const file of validFiles) {
        await validatePdfMagicBytes(file)
    }

    const BATCH_SIZE = 10
    const MAX_BATCH_BYTES = 20 * 1024 * 1024 // 20MB

    // Group files into batches based on count and total size
    let currentBatchFiles: File[] = []
    let currentBatchSize = 0
    const batches: File[][] = []

    for (const file of validFiles) {
        if (
            currentBatchFiles.length >= BATCH_SIZE ||
            (currentBatchFiles.length > 0 &&
                currentBatchSize + file.size > MAX_BATCH_BYTES)
        ) {
            batches.push(currentBatchFiles)
            currentBatchFiles = []
            currentBatchSize = 0
        }
        currentBatchFiles.push(file)
        currentBatchSize += file.size
    }
    if (currentBatchFiles.length > 0) {
        batches.push(currentBatchFiles)
    }

    // Process each batch sequentially to avoid overwhelming the API
    const allBatchFields: any[] = []
    for (let i = 0; i < batches.length; i++) {
        const batchFiles = batches[i]
        const batchFormData = new FormData()
        for (const file of batchFiles) {
            batchFormData.append("soilAnalysisFile", file)
        }

        const responseApi = await fetch("https://api.nmi-agro.nl/soilreader", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${nmiApiKey}`,
            },
            body: batchFormData,
        })

        if (!responseApi.ok) {
            const text = await responseApi.text()
            console.error(
                `NMI API Error (Batch ${i + 1}/${batches.length}): ${responseApi.status} ${responseApi.statusText}`,
                text,
            )

            if (responseApi.status === 413) {
                throw new Error(
                    `invalid: Groep ${i + 1} van de bestanden is te groot voor de NMI API. Verklein de PDF's of upload ze in nog kleinere groepen.`,
                )
            }

            throw new Error(
                `Request to NMI API failed: ${responseApi.status} ${responseApi.statusText}`,
            )
        }

        const result = await responseApi.json()
        const responseData = result?.data

        if (!responseData?.fields || !Array.isArray(responseData.fields)) {
            console.error(
                `Invalid NMI API response structure in batch ${i + 1}:`,
                JSON.stringify(result, null, 2),
            )
            throw new Error(
                `Invalid API response in batch ${i + 1}: no fields found`,
            )
        }

        allBatchFields.push(...responseData.fields)
    }

    return allBatchFields.map((field: any, index: number) => {
        const soilAnalysis: { [key: string]: any } = {
            id: crypto.randomUUID(), // Used for UI matching
            filename: field.filename || `Analyse ${index + 1}`,
            b_name: field.b_fieldname, // Map b_fieldname for name matching
        }

        // Safely map known soil parameters (starting with a_)
        for (const key of Object.keys(field).filter((key) =>
            key.startsWith("a_"),
        )) {
            soilAnalysis[key] = field[key]
        }

        if (field.b_date) {
            const dateParts = field.b_date.split("-")
            if (dateParts.length === 3) {
                const day = Number.parseInt(dateParts[0], 10)
                const month = Number.parseInt(dateParts[1], 10) - 1
                const year = Number.parseInt(dateParts[2], 10)

                if (
                    !Number.isNaN(day) &&
                    !Number.isNaN(month) &&
                    !Number.isNaN(year)
                ) {
                    soilAnalysis.b_sampling_date = new Date(year, month, day)
                }
            }
        }

        if (field.b_soiltype_agr) {
            soilAnalysis.b_soil_type = field.b_soiltype_agr
        }

        if (field.b_depth) {
            const depthParts = field.b_depth.split("-")
            if (depthParts.length !== 2) {
                throw new Error(`Invalid depth format: ${field.b_depth}`)
            }
            const upper = Number(depthParts[0])
            const lower = Number(depthParts[1])
            if (Number.isNaN(upper) || Number.isNaN(lower)) {
                throw new Error(
                    `Invalid numeric depth values: ${field.b_depth}`,
                )
            }
            soilAnalysis.a_depth_upper = upper
            soilAnalysis.a_depth_lower = lower
        }

        // Add coordinates for geometry matching, but keep them separate from the main analysis data
        // NMI API uses RD New (EPSG:28992) with keys b_loc_x and b_loc_y
        const x_rd = field.b_loc_x
        const y_rd = field.b_loc_y

        if (x_rd && y_rd) {
            const numericX = Number(x_rd)
            const numericY = Number(y_rd)

            if (!Number.isNaN(numericX) && !Number.isNaN(numericY)) {
                try {
                    // Transform from RD New to WGS84
                    const [lon, lat] = proj4("EPSG:28992", "EPSG:4326", [
                        numericX,
                        numericY,
                    ])
                    soilAnalysis.location = {
                        type: "Point",
                        coordinates: [lon, lat],
                    }
                } catch (e) {
                    console.error("Coordinate transformation failed:", e)
                }
            }
        }

        // Fallback for WGS84 if provided directly under other keys
        if (!soilAnalysis.location) {
            const lat = field.a_lat ?? field.latitude ?? field.lat
            const lon = field.a_lon ?? field.longitude ?? field.lon

            if (lat != null && lon != null) {
                const numericLat = Number(lat)
                const numericLon = Number(lon)

                if (!Number.isNaN(numericLat) && !Number.isNaN(numericLon)) {
                    soilAnalysis.location = {
                        type: "Point",
                        coordinates: [numericLon, numericLat],
                    }
                }
            }
        }

        return soilAnalysis
    })
}
