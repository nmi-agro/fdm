import {
  aggregateNormFillingsToFarmLevel,
  aggregateNormsToFarmLevel,
  calculateDose,
  createFunctionsForFertilizerApplicationFilling,
  createFunctionsForNorms,
  fdmCalculator,
  type GebruiksnormResult,
  getMainCultivation,
  getNutrientAdvice,
  getOrganicMatterBalanceField,
  NormFilling,
} from "@nmi-agro/fdm-calculator"
import {
  type FdmType,
  getCultivationsForFarm,
  getCultivationsFromCatalogue,
  getCurrentSoilDataForFarm,
  getFarm,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  getFields,
  getGrazingIntention,
  getSoilAnalysesForFarm,
  isDerogationGrantedForYear,
  isOrganicCertificationValid,
} from "@nmi-agro/fdm-core"
import { generateCalculationHash } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import fs from "node:fs/promises"
import path from "node:path"
import type { FieldNormFillings, FieldNormValues } from "~/integrations/calculator"
import { BemestingsplanData } from "~/components/blocks/pdf/bemestingsplan/types"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { serverConfig } from "~/lib/config.server"
import { fdm } from "~/lib/fdm.server"

async function getBase64Image(filePath: string | undefined): Promise<string | undefined> {
  if (!filePath) return undefined
  try {
    const ext = path.extname(filePath).toLowerCase().substring(1)
    const mimeType =
      ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : "application/octet-stream"
    const buffer = await fs.readFile(filePath)
    return `data:${mimeType};base64,${buffer.toString("base64")}`
  } catch (e) {
    if ((e as { code: string })?.code === "ENOENT") return undefined
    console.warn(`Failed to read image file at ${filePath}`, e)
    return undefined
  }
}

function formatDate(date: Date | string | number | undefined): string {
  if (!date) return "-"
  return format(date, "d MMM", { locale: nl })
}

const DEROGATION_GRANTED_NEEDED_FOR_YEARS = [2025]
function isNormYear(year: string): year is "2025" | "2026" {
  return year === "2025" || year === "2026"
}

export async function collectBemestingsplanInputFromDatabase(
  fdm: FdmType,
  principal_id: string,
  b_id_farm: string,
  year: number,
) {
  const timeframe = getTimeframe({ calendar: String(year) })

  const [
    farm,
    fields,
    cultivationsCatalogue,
    fertilizersCatalogue,
    cultivationsMap,
    fertilizerApplicationsMap,
    soilAnalysesMap,
    currentSoilDataMap,
    derogationGranted,
    has_organic_certification,
    has_grazing_intention,
  ] = await Promise.all([
    getFarm(fdm, principal_id, b_id_farm),
    getFields(fdm, principal_id, b_id_farm, timeframe),
    getCultivationsFromCatalogue(fdm, principal_id, b_id_farm),
    getFertilizers(fdm, principal_id, b_id_farm),
    getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getSoilAnalysesForFarm(fdm, principal_id, b_id_farm, timeframe),
    getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm, timeframe),
    DEROGATION_GRANTED_NEEDED_FOR_YEARS.includes(year)
      ? isDerogationGrantedForYear(fdm, principal_id, b_id_farm, year)
      : null,
    isOrganicCertificationValid(
      fdm,
      principal_id,
      b_id_farm,
      new Date(year, 4, 15), // May 15th of the specified year
    ),
    getGrazingIntention(fdm, principal_id, b_id_farm, year),
  ])

  // `config` is not part of this since it is purely stylistic and it doesn't affect the contemporary data
  return {
    year: year,
    farm: farm,
    fields: fields.map((field) => ({
      ...field,
      fertilizerApplications: fertilizerApplicationsMap.get(field.b_id) ?? [],
      cultivations: cultivationsMap.get(field.b_id) ?? [],
      soilAnalyses: soilAnalysesMap.get(field.b_id) ?? [],
      currentSoilData: currentSoilDataMap.get(field.b_id) ?? [],
    })),
    fertilizersCatalogue: fertilizersCatalogue,
    cultivationsCatalogue: cultivationsCatalogue,
    derogationGranted: derogationGranted,
    has_organic_certification: has_organic_certification,
    has_grazing_intention: has_grazing_intention,
  }
}

export function getBemestingsplanInputHash(input: BemestingsplanInput) {
  return generateCalculationHash(
    "computeBemestingsplan",
    `fdm-app:${import.meta.env.PUBLIC_APP_VERSION}|${fdmCalculator.calculatorVersion}`,
    input,
  )
}

type BemestingsplanInput = Awaited<ReturnType<typeof collectBemestingsplanInputFromDatabase>>

async function computeBemestingsplanConfig() {
  // Resolve public directory dynamically to handle both dev (monorepo root) and Docker/prod (app root)
  let publicDir = path.resolve(process.cwd(), "public")
  try {
    const monorepoPublicDir = path.resolve(process.cwd(), "fdm-app", "public")
    const stat = await fs.stat(monorepoPublicDir)
    if (stat.isDirectory()) {
      publicDir = monorepoPublicDir
    }
    // oxlint-disable-next-line no-unused-vars - monorepoPublicDir is not assumed to exist in this case
  } catch (_) {}

  const relativeLogoPath = clientConfig.logomark?.startsWith("/")
    ? clientConfig.logomark.substring(1)
    : clientConfig.logomark
  const logoPathRaw = relativeLogoPath ? path.join(publicDir, relativeLogoPath) : undefined
  const logoInvertedPathRaw: string | undefined = path.join(
    publicDir,
    "fdm-high-resolution-logo-transparent-no-text.png",
  )

  const coverImagePathRaw: string | undefined = path.join(publicDir, "bemestingsplan_cover.jpg")

  const [logoDataUri, logoInvertedDataUri, coverImageDataUri] = await Promise.all([
    getBase64Image(logoPathRaw),
    getBase64Image(logoInvertedPathRaw),
    getBase64Image(coverImagePathRaw),
  ])

  return {
    name: clientConfig.name,
    logo: logoDataUri,
    logoInverted: logoInvertedDataUri,
    coverImage: coverImageDataUri,
  }
}

export async function computeBemestingsplanData({
  year,
  farm,
  fields,
  fertilizersCatalogue,
  cultivationsCatalogue,
  derogationGranted,
  has_organic_certification,
  has_grazing_intention,
}: BemestingsplanInput): Promise<BemestingsplanData> {
  const configPromise = computeBemestingsplanConfig()

  const pdfFieldsData: BemestingsplanData["fields"] = []

  const timeframe = getTimeframe({ calendar: String(year) }) as { start: Date; end: Date }

  const batchSize = 10
  for (let batchStart = 0; batchStart < fields.length; batchStart += batchSize) {
    await Promise.all(
      fields.slice(batchStart, batchStart + batchSize).map(async (fieldExtended) => {
        const { fertilizerApplications, cultivations, soilAnalyses, currentSoilData, ...field } =
          fieldExtended
        try {
          // Main cultivation
          const mainCultivation = getMainCultivation(cultivations, year)
          const catchCrop = mainCultivation
            ? cultivations.find((c) => c.b_lu !== mainCultivation.b_lu)
            : undefined

          // Soil parameters
          const soilParams: Record<string, any> = {}
          let samplingDate: Date | undefined
          if (Array.isArray(currentSoilData)) {
            for (const item of currentSoilData) {
              soilParams[item.parameter] = item.value
              if (item.b_sampling_date && (!samplingDate || item.b_sampling_date > samplingDate)) {
                samplingDate = item.b_sampling_date
              }
            }
          }

          // Norms
          let normsResult: { value: FieldNormValues; filling: FieldNormFillings } | undefined
          const yearStr = String(year)
          if (isNormYear(yearStr)) {
            const normFunctions = createFunctionsForNorms("NL", yearStr)
            const normFillingFunctions = createFunctionsForFertilizerApplicationFilling(
              "NL",
              yearStr,
            )
            const normInput = {
              farm: {
                ...((derogationGranted === null
                  ? {}
                  : { is_derogatie_bedrijf: derogationGranted }) as any),
                has_grazing_intention: has_grazing_intention,
              },
              field: field,
              cultivations: cultivations,
              soilAnalysis: {
                a_p_cc: currentSoilData.find((x: { parameter: string }) => x.parameter === "a_p_cc")
                  ?.value as number | null,
                a_p_al: currentSoilData.find((x: { parameter: string }) => x.parameter === "a_p_al")
                  ?.value as number | null,
              },
            }

            const normForPhosphatePromise = normFunctions.calculateNormForPhosphate(fdm, normInput)

            const renurePromise: Promise<GebruiksnormResult | undefined> =
              "calculateNormForRenure" in normFunctions
                ? normFunctions.calculateNormForRenure(fdm, normInput)
                : Promise.resolve(undefined)

            const [nitrogen, manure, renure] = await Promise.all([
              normFunctions.calculateNormForNitrogen(fdm, normInput),
              normFunctions.calculateNormForManure(fdm, normInput),
              renurePromise,
            ])

            const [nitrogenFilling, phosphateFilling, manureFilling, renureFilling] =
              await normForPhosphatePromise.then((fosfaatgebruiksnorm) => {
                const fillingInput = {
                  cultivations: cultivations,
                  applications: fertilizerApplications,
                  fertilizers: fertilizersCatalogue,
                  has_organic_certification: has_organic_certification,
                  has_grazing_intention: has_grazing_intention,
                  fosfaatgebruiksnorm: fosfaatgebruiksnorm.normValue,
                  b_centroid: field.b_centroid,
                }
                const renureFillingPromise: Promise<NormFilling | undefined> =
                  "calculateFertilizerApplicationFillingForRenure" in normFillingFunctions
                    ? normFillingFunctions.calculateFertilizerApplicationFillingForRenure(
                        fdm,
                        fillingInput,
                      )
                    : Promise.resolve(undefined)

                return Promise.all([
                  normFillingFunctions.calculateFertilizerApplicationFillingForNitrogen(
                    fdm,
                    fillingInput,
                  ),
                  normFillingFunctions.calculateFertilizerApplicationFillingForPhosphate(
                    fdm,
                    fillingInput,
                  ),
                  normFillingFunctions.calculateFertilizerApplicationFillingForManure(
                    fdm,
                    fillingInput,
                  ),
                  renureFillingPromise,
                ])
              })

            normsResult = {
              value: {
                nitrogen: nitrogen,
                phosphate: await normForPhosphatePromise,
                manure: manure,
                renure: renure,
              },
              filling: {
                nitrogen: nitrogenFilling,
                phosphate: phosphateFilling,
                manure: manureFilling,
                renure: renureFilling,
              },
            }
          }

          // Nutrient advice
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
              const result = await getNutrientAdvice(fdm, {
                b_lu_catalogue: mainCultivation.b_lu_catalogue,
                b_centroid: field.b_centroid,
                currentSoilData: currentSoilData,
                nmiApiKey: serverConfig.integrations.nmi?.api_key,
                b_bufferstrip: field.b_bufferstrip,
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
            console.error(`Failed to get nutrient advice for field ${field.b_id}:`, e)
          }

          // Calculate Doses (Planned)
          const { dose: plannedDose, applications: plannedApplicationDoses } = calculateDose({
            applications: fertilizerApplications,
            fertilizers: fertilizersCatalogue,
          })

          // Organic matter balance
          const omInput = {
            fieldInput: {
              field: field,
              cultivations: cultivations,
              soilAnalyses: soilAnalyses,
              fertilizerApplications: fertilizerApplications,
            },
            fertilizerDetails: fertilizersCatalogue,
            cultivationDetails: cultivationsCatalogue,
            timeFrame: timeframe,
          }
          const omBalanceResult = await getOrganicMatterBalanceField(fdm, omInput)

          const fieldData: (typeof pdfFieldsData)[number] = {
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
            norms: normsResult
              ? {
                  nitrogen: normsResult.value.nitrogen.normValue,
                  manure: normsResult.value.manure.normValue,
                  phosphate: normsResult.value.phosphate.normValue,
                  renure: normsResult.value.renure?.normValue,
                }
              : { nitrogen: 0, manure: 0, phosphate: 0, renure: 0 },
            normsFilling: normsResult
              ? {
                  nitrogen: normsResult.filling.nitrogen.normFilling,
                  manure: normsResult.filling.manure.normFilling,
                  phosphate: normsResult.filling.phosphate.normFilling,
                  renure: normsResult.filling.renure?.normFilling,
                }
              : { nitrogen: 0, manure: 0, phosphate: 0 },
            advice: adviceKgHa,
            planned: plannedDose,
            omBalance: omBalanceResult
              ? {
                  balance: omBalanceResult.balance,
                  supply: omBalanceResult.supply.total,
                  supplyManure: omBalanceResult.supply.fertilizers.manure.total,
                  supplyCompost: omBalanceResult.supply.fertilizers.compost.total,
                  supplyCultivations: omBalanceResult.supply.cultivations.total,
                  supplyResidues: omBalanceResult.supply.residues.total,
                  degradation: omBalanceResult.degradation.total,
                }
              : undefined,
            applications: plannedApplicationDoses.map((plannedApp) => {
              const appDose = plannedApp ?? {
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
              const app = appDose.p_app_id
                ? fertilizerApplications.find((p_app) => p_app.p_app_id === appDose.p_app_id)
                : undefined
              const fert = app ? fertilizersCatalogue.find((f) => f.p_id === app.p_id) : undefined

              return {
                date: formatDate(app?.p_app_date),
                product: fert?.p_name_nl ?? app?.p_id ?? "onbekend",
                quantity: app?.p_app_amount ?? 0,
                quantity_display: app?.p_app_amount_display ?? 0,
                quantity_unit: app?.p_app_amount_unit ?? "kg/ha",
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

          pdfFieldsData.push(fieldData)
        } catch (error) {
          console.error(`Error processing field ${fieldExtended.b_id}:`, error)
          pdfFieldsData.push({
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
          })
        }
      }),
    )
  }

  // Aggregates for farm level (Total kg)
  const totalArea = fields.reduce((acc, f) => acc + (f.b_area || 0), 0)
  const productiveArea = fields.reduce((acc, f) => acc + (f.b_bufferstrip ? 0 : f.b_area || 0), 0)

  // Correctly aggregate norms and fillings using calculator functions
  const totalNormsKg = aggregateNormsToFarmLevel(
    pdfFieldsData.map((f) => ({
      b_id: f.id,
      b_area: f.area,
      norms: {
        manure: { normValue: f.norms.manure, normSource: "" },
        nitrogen: { normValue: f.norms.nitrogen, normSource: "" },
        phosphate: { normValue: f.norms.phosphate, normSource: "" },
        renure: f.norms.renure ? { normValue: f.norms.renure, normSource: "" } : undefined,
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
        renure:
          typeof f.normsFilling?.renure === "number"
            ? {
                normFilling: f.normsFilling.renure,
                applicationFilling: [],
              }
            : undefined,
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
                balance: acc.balance + f.omBalance.balance * f.area,
                supply: acc.supply + f.omBalance.supply * f.area,
                degradation: acc.degradation + f.omBalance.degradation * f.area,
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
    degradation: totalArea > 0 ? totalOmBalance.degradation / totalArea : 0,
  }

  const data = {
    config: await configPromise,
    farm: {
      name: farm.b_name_farm || "Onbekend",
      kvk: farm.b_businessid_farm || undefined,
    },
    year: String(year),
    totalArea: totalArea,
    productiveArea: productiveArea,
    norms: totalNormsKg,
    normsFilling: totalNormsFillingKg,
    totalAdvice: totalAdviceKg,
    plannedUsage: totalPlannedUsageKg,
    omBalance: farmOmBalance,
    fields: pdfFieldsData,
  }

  return data
}
