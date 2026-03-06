import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import {
    aggregateNormFillingsToFarmLevel,
    aggregateNormsToFarmLevel,
    collectInputForOrganicMatterBalance,
    getOrganicMatterBalanceField,
} from "@nmi-agro/fdm-calculator"
import {
    getCultivations,
    getCurrentSoilData,
    getFarm,
    getFields,
} from "@nmi-agro/fdm-core"
import { renderToStream } from "@react-pdf/renderer"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { data, type LoaderFunctionArgs } from "react-router"
import { BemestingsplanPDF } from "~/components/blocks/pdf/bemestingsplan/BemestingsplanPDF"
import type { BemestingsplanData } from "~/components/blocks/pdf/bemestingsplan/types"
import {
    getNorms,
    getNutrientAdviceForField,
    getPlannedDosesForField,
} from "~/integrations/calculator"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { getDefaultCultivation } from "~/lib/cultivation-helpers"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

const formatDate = (date: Date | null | undefined) => {
    if (!date) return "-"
    return format(date, "d MMM", { locale: nl })
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        const calendar = getCalendar(params)
        const timeframe = getTimeframe(params)

        if (!b_id_farm) {
            throw data("Farm ID is required", { status: 400 })
        }

        const session = await getSession(request)

        // 1. Fetch Farm Info
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)
        if (!farm) {
            throw data("Farm not found", { status: 404 })
        }

        // 2. Fetch Fields
        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )

        // Get input for OM balance
        const omInput = await collectInputForOrganicMatterBalance(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )

        const pdfFieldsData = await Promise.all(
            fields.map(async (field) => {
                try {
                    // Fetch display data (and data needed for OM balance if not using integration for it completely)
                    const [cultivations, currentSoilData] = await Promise.all([
                        getCultivations(
                            fdm,
                            session.principal_id,
                            field.b_id,
                            timeframe,
                        ),
                        getCurrentSoilData(
                            fdm,
                            session.principal_id,
                            field.b_id,
                        ),
                    ])

                    const mainCultivation =
                        getDefaultCultivation(cultivations, calendar) ||
                        cultivations[0]
                    const catchCrop = cultivations.find(
                        (c) => c.b_lu !== mainCultivation?.b_lu,
                    )

                    // OM Balance for this field
                    const fieldOmInput = omInput.fields.find(
                        (f) => f.field.b_id === field.b_id,
                    )
                    let omBalanceResult
                    if (fieldOmInput) {
                        omBalanceResult = await getOrganicMatterBalanceField(
                            fdm,
                            {
                                fieldInput: fieldOmInput,
                                fertilizerDetails: omInput.fertilizerDetails,
                                cultivationDetails: omInput.cultivationDetails,
                                timeFrame: omInput.timeFrame,
                            },
                        )
                    }

                    // Extract soil parameters for display
                    const soilParams: Record<string, any> = {}
                    let samplingDate: Date | undefined
                    if (Array.isArray(currentSoilData)) {
                        for (const item of currentSoilData) {
                            soilParams[item.parameter] = item.value
                            if (
                                item.b_sampling_date &&
                                (!samplingDate ||
                                    item.b_sampling_date > samplingDate)
                            ) {
                                samplingDate = item.b_sampling_date
                            }
                        }
                    }

                    // 3. Use Integration Functions for Calculations

                    // Calculate Norms & Filling
                    const normsResult = await getNorms({
                        fdm,
                        principal_id: session.principal_id,
                        b_id: field.b_id,
                        calendar: calendar as "2025" | "2026",
                    })

                    // Calculate Nutrient Advice
                    let adviceKgHa = {
                        d_n_req: 0,
                        d_p_req: 0,
                        d_k_req: 0,
                        d_mg_req: 0,
                        d_s_req: 0,
                        d_c_req: 0,
                        d_ca_req: 0,
                        d_na_req: 0,
                        d_cu_req: 0,
                        d_zn_req: 0,
                        d_co_req: 0,
                        d_mn_req: 0,
                        d_mo_req: 0,
                        d_b_req: 0,
                    }
                    try {
                        if (mainCultivation) {
                            const result = await getNutrientAdviceForField({
                                fdm,
                                principal_id: session.principal_id,
                                b_id: field.b_id,
                                b_centroid: field.b_centroid,
                                timeframe,
                                calendar,
                            })

                            if (result) {
                                adviceKgHa = {
                                    d_n_req: result.d_n_req || 0,
                                    d_p_req: result.d_p_req || 0,
                                    d_k_req: result.d_k_req || 0,
                                    d_mg_req: result.d_mg_req || 0,
                                    d_s_req: result.d_s_req || 0,
                                    d_c_req: result.d_c_req || 0,
                                    d_ca_req: result.d_ca_req || 0,
                                    d_na_req: result.d_na_req || 0,
                                    d_cu_req: result.d_cu_req || 0,
                                    d_zn_req: result.d_zn_req || 0,
                                    d_co_req: result.d_co_req || 0,
                                    d_mn_req: result.d_mn_req || 0,
                                    d_mo_req: result.d_mo_req || 0,
                                    d_b_req: result.d_b_req || 0,
                                }
                            }
                        }
                    } catch (e) {
                        console.error(
                            `Failed to get nutrient advice for field ${field.b_id}:`,
                            e,
                        )
                    }

                    // Calculate Doses (Planned)
                    const {
                        doses: dosesResult,
                        applications,
                        fertilizers,
                    } = await getPlannedDosesForField({
                        fdm,
                        principal_id: session.principal_id,
                        b_id: field.b_id,
                        b_id_farm,
                        timeframe,
                    })

                    const plannedKgHa = dosesResult.dose

                    return {
                        id: field.b_id,
                        name: field.b_name,
                        area: field.b_area || 0,
                        isBufferstrip: field.b_bufferstrip,
                        mainCrop: mainCultivation?.b_lu_name || "Geen gewas",
                        catchCrop: catchCrop?.b_lu_name,
                        soil: {
                            b_sampling_date: formatDate(samplingDate),
                            a_ph_cc: soilParams.a_ph_cc,
                            a_p_al: soilParams.a_p_al,
                            a_p_cc: soilParams.a_p_cc,
                            a_k_cc: soilParams.a_k_cc,
                            a_som_loi: soilParams.a_som_loi,
                            b_soiltype_agr: soilParams.b_soiltype_agr,
                            a_clay_mi: soilParams.a_clay_mi,
                            a_sand_mi: soilParams.a_sand_mi,
                            a_silt_mi: soilParams.a_silt_mi,
                        },
                        norms: {
                            nitrogen: normsResult.value.nitrogen,
                            manure: normsResult.value.manure,
                            phosphate: normsResult.value.phosphate,
                        },
                        normsFilling: {
                            nitrogen: normsResult.filling.nitrogen,
                            manure: normsResult.filling.manure,
                            phosphate: normsResult.filling.phosphate,
                        },
                        advice: adviceKgHa,
                        planned: plannedKgHa,
                        omBalance: omBalanceResult
                            ? {
                                  balance: omBalanceResult.balance,
                                  supply: omBalanceResult.supply.total,
                                  supplyManure:
                                      omBalanceResult.supply.fertilizers.manure
                                          .total,
                                  supplyCompost:
                                      omBalanceResult.supply.fertilizers.compost
                                          .total,
                                  supplyCultivations:
                                      omBalanceResult.supply.cultivations.total,
                                  supplyResidues:
                                      omBalanceResult.supply.residues.total,
                                  degradation:
                                      omBalanceResult.degradation.total,
                              }
                            : undefined,
                        applications: applications.map((app, idx) => {
                            const fert = fertilizers.find(
                                (f) => f.p_id === app.p_id,
                            )
                            const appDose = dosesResult.applications[idx] ?? {
                                p_dose_n: 0,
                                p_dose_nw: 0,
                                p_dose_p: 0,
                                p_dose_k: 0,
                                p_dose_eoc: 0,
                                p_dose_mg: 0,
                                p_dose_s: 0,
                                p_dose_ca: 0,
                                p_dose_na: 0,
                                p_dose_cu: 0,
                                p_dose_zn: 0,
                                p_dose_co: 0,
                                p_dose_mn: 0,
                                p_dose_mo: 0,
                                p_dose_b: 0,
                            }

                            return {
                                date: formatDate(app.p_app_date),
                                product: fert?.p_name_nl || app.p_id,
                                quantity: app.p_app_amount || 0,
                                p_dose_n: appDose.p_dose_n || 0,
                                p_dose_nw: appDose.p_dose_nw || 0,
                                p_dose_p: appDose.p_dose_p || 0,
                                p_dose_k: appDose.p_dose_k || 0,
                                p_dose_eoc: appDose.p_dose_eoc || 0,
                                p_dose_mg: appDose.p_dose_mg || 0,
                                p_dose_s: appDose.p_dose_s || 0,
                                p_dose_ca: appDose.p_dose_ca || 0,
                                p_dose_na: appDose.p_dose_na || 0,
                                p_dose_cu: appDose.p_dose_cu || 0,
                                p_dose_zn: appDose.p_dose_zn || 0,
                                p_dose_co: appDose.p_dose_co || 0,
                                p_dose_mn: appDose.p_dose_mn || 0,
                                p_dose_mo: appDose.p_dose_mo || 0,
                                p_dose_b: appDose.p_dose_b || 0,
                            }
                        }),
                    }
                } catch (error) {
                    console.error(
                        `Error processing field ${field.b_id}:`,
                        error,
                    )
                    return {
                        id: field.b_id,
                        name: field.b_name,
                        area: field.b_area || 0,
                        isBufferstrip: field.b_bufferstrip,
                        mainCrop: "Fout bij laden",
                        soil: {},
                        norms: { nitrogen: 0, manure: 0, phosphate: 0 },
                        normsFilling: { nitrogen: 0, manure: 0, phosphate: 0 },
                        advice: {
                            d_n_req: 0,
                            d_p_req: 0,
                            d_k_req: 0,
                            d_mg_req: 0,
                            d_s_req: 0,
                            d_c_req: 0,
                            d_ca_req: 0,
                            d_na_req: 0,
                            d_cu_req: 0,
                            d_zn_req: 0,
                            d_co_req: 0,
                            d_mn_req: 0,
                            d_mo_req: 0,
                            d_b_req: 0,
                        },
                        planned: {
                            p_dose_n: 0,
                            p_dose_nw: 0,
                            p_dose_p: 0,
                            p_dose_k: 0,
                            p_dose_eoc: 0,
                            p_dose_mg: 0,
                            p_dose_s: 0,
                            p_dose_ca: 0,
                            p_dose_na: 0,
                            p_dose_cu: 0,
                            p_dose_zn: 0,
                            p_dose_co: 0,
                            p_dose_mn: 0,
                            p_dose_mo: 0,
                            p_dose_b: 0,
                        },
                        applications: [],
                    }
                }
            }),
        )

        // Aggregates for farm level (Total kg)
        const totalArea = fields.reduce((acc, f) => acc + (f.b_area || 0), 0)
        const productiveArea = fields.reduce(
            (acc, f) => acc + (f.b_bufferstrip ? 0 : f.b_area || 0),
            0,
        )

        // Correctly aggregate norms and fillings using calculator functions
        const totalNormsKg = aggregateNormsToFarmLevel(
            pdfFieldsData.map((f) => ({
                b_id: f.id,
                b_area: f.area,
                norms: {
                    manure: { normValue: f.norms.manure, normSource: "" },
                    nitrogen: { normValue: f.norms.nitrogen, normSource: "" },
                    phosphate: { normValue: f.norms.phosphate, normSource: "" },
                },
            })),
        )

        const totalNormsFillingKg = aggregateNormFillingsToFarmLevel(
            pdfFieldsData.map((f) => ({
                b_id: f.id,
                b_area: f.area,
                normsFilling: {
                    manure: {
                        normFilling: f.normsFilling?.manure || 0,
                        applicationFilling: [],
                    },
                    nitrogen: {
                        normFilling: f.normsFilling?.nitrogen || 0,
                        applicationFilling: [],
                    },
                    phosphate: {
                        normFilling: f.normsFilling?.phosphate || 0,
                        applicationFilling: [],
                    },
                },
            })),
        )

        const totalAdviceKg = pdfFieldsData.reduce(
            (acc, f) => ({
                d_n_req: acc.d_n_req + f.advice.d_n_req * f.area,
                d_p_req: acc.d_p_req + f.advice.d_p_req * f.area,
                d_k_req: acc.d_k_req + f.advice.d_k_req * f.area,
                d_c_req: acc.d_c_req + f.advice.d_c_req * f.area,
            }),
            { d_n_req: 0, d_p_req: 0, d_k_req: 0, d_c_req: 0 },
        )

        const totalPlannedUsageKg = pdfFieldsData.reduce(
            (acc, f) => ({
                p_dose_n: acc.p_dose_n + f.planned.p_dose_n * f.area,
                p_dose_nw: acc.p_dose_nw + f.planned.p_dose_nw * f.area,
                p_dose_p: acc.p_dose_p + f.planned.p_dose_p * f.area,
                p_dose_k: acc.p_dose_k + f.planned.p_dose_k * f.area,
                p_dose_eoc: acc.p_dose_eoc + f.planned.p_dose_eoc * f.area,
            }),
            {
                p_dose_n: 0,
                p_dose_nw: 0,
                p_dose_p: 0,
                p_dose_k: 0,
                p_dose_eoc: 0,
            },
        )

        // Calculate aggregate OM balance (weighted average per ha)
        const totalOmBalance =
            totalArea > 0
                ? pdfFieldsData.reduce(
                      (acc, f) => {
                          if (f.omBalance) {
                              return {
                                  balance:
                                      acc.balance +
                                      f.omBalance.balance * f.area,
                                  supply:
                                      acc.supply + f.omBalance.supply * f.area,
                                  degradation:
                                      acc.degradation +
                                      f.omBalance.degradation * f.area,
                              }
                          }
                          return acc
                      },
                      { balance: 0, supply: 0, degradation: 0 },
                  )
                : { balance: 0, supply: 0, degradation: 0 }

        const farmOmBalance = {
            balance: totalArea > 0 ? totalOmBalance.balance / totalArea : 0,
            supply: totalArea > 0 ? totalOmBalance.supply / totalArea : 0,
            degradation:
                totalArea > 0 ? totalOmBalance.degradation / totalArea : 0,
        }

        // Resolve public directory dynamically to handle both dev (monorepo root) and Docker/prod (app root)
        let publicDir = path.resolve(process.cwd(), "public")
        if (!fs.existsSync(publicDir)) {
            // Fallback for monorepo dev environment where cwd is root but app is in fdm-app
            const monorepoPublicDir = path.resolve(
                process.cwd(),
                "fdm-app",
                "public",
            )
            if (fs.existsSync(monorepoPublicDir)) {
                publicDir = monorepoPublicDir
            }
        }

        // Helper to get base64 data URI from file path
        const getBase64Image = (
            filePath: string | undefined,
        ): string | undefined => {
            if (!filePath || !fs.existsSync(filePath)) return undefined
            try {
                const ext = path.extname(filePath).toLowerCase().substring(1)
                const mimeType =
                    ext === "png"
                        ? "image/png"
                        : ext === "jpg" || ext === "jpeg"
                          ? "image/jpeg"
                          : "application/octet-stream"
                const buffer = fs.readFileSync(filePath)
                return `data:${mimeType};base64,${buffer.toString("base64")}`
            } catch (e) {
                console.warn(`Failed to read image file at ${filePath}`, e)
                return undefined
            }
        }

        const relativeLogoPath = clientConfig.logomark?.startsWith("/")
            ? clientConfig.logomark.substring(1)
            : clientConfig.logomark

        const logoPathRaw = relativeLogoPath
            ? path.join(publicDir, relativeLogoPath)
            : undefined

        const logoDataUri = getBase64Image(logoPathRaw)

        const logoInvertedPathRaw: string | undefined = path.join(
            publicDir,
            "fdm-high-resolution-logo-transparent-no-text.png",
        )

        const logoInvertedDataUri = getBase64Image(logoInvertedPathRaw)

        const coverImagePathRaw: string | undefined = path.join(
            publicDir,
            "bemestingsplan_cover.jpg",
        )

        const coverImageDataUri = getBase64Image(coverImagePathRaw)

        const bemestingsplanData: BemestingsplanData = {
            config: {
                name: clientConfig.name,
                logo: logoDataUri,
                logoInverted: logoInvertedDataUri,
                coverImage: coverImageDataUri,
            },
            farm: {
                name: farm.b_name_farm || "Onbekend",
                kvk: farm.b_businessid_farm || undefined,
            },
            year: calendar,
            totalArea,
            productiveArea,
            norms: totalNormsKg,
            normsFilling: totalNormsFillingKg,
            totalAdvice: totalAdviceKg,
            plannedUsage: totalPlannedUsageKg,
            omBalance: farmOmBalance,
            fields: pdfFieldsData,
        }

        const stream = await renderToStream(
            <BemestingsplanPDF data={bemestingsplanData} />,
        )

        // Sanitize and encode filename for Content-Disposition header
        const safeName = (farm.b_name_farm || b_id_farm).replace(
            /[^\w\s-]/g,
            "_",
        )
        const baseFilename = `Bemestingsplan_${safeName}_${calendar}.pdf`
        const encodedName = encodeURIComponent(baseFilename)

        return new Response(
            Readable.toWeb(stream) as unknown as ReadableStream,
            {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="${baseFilename}"; filename*=UTF-8''${encodedName}`,
                },
            },
        )
    } catch (error) {
        throw handleLoaderError(error)
    }
}
