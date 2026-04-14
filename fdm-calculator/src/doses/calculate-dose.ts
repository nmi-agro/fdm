import type { BaseFertilizerApplication, Fertilizer } from "@nmi-agro/fdm-core"
import type { Dose, NumericDoseKeys } from "./d"

/**
 * Calculates the cumulative nutrient doses from a series of fertilizer applications.
 *
 * This function processes an array of fertilizer applications, matching each with its corresponding fertilizer definition to calculate the dose of each nutrient. The nutrient rates are converted from grams or milligrams per kilogram to kilograms per kilogram and then multiplied by the application amount to determine the dose in kg/ha.
 *
 * @param applications An array of fertilizer application objects, each specifying the fertilizer `p_id` and the applied amount `p_app_amount` in kg/ha.
 * @param fertilizers An array of fertilizer objects, providing the nutrient rates for each fertilizer. Nutrient rates are expected to be non-negative.
 * @returns An object containing:
 *   - `dose`: An object with the total cumulative doses for all nutrients in kg/ha.
 *   - `applications`: An array of objects, each detailing the individual nutrient doses for each fertilizer application.
 * @throws {Error} If any application amount or nutrient rate is negative, ensuring data integrity.
 *
 * @example
 * ```typescript
 * import { calculateDose } from "./calculate-dose";
 *
 * const applications = [
 *   { p_app_id: "app1", p_id: "fert1", p_app_amount: 100 },
 *   { p_app_id: "app2", p_id: "fert2", p_app_amount: 50 },
 * ];
 *
 * const fertilizers = [
 *   { p_id: "fert1", p_n_rt: 100, p_p_rt: 50, p_k_rt: 30, p_n_wc: 0.5, p_s_rt: 20, p_mg_rt: 10 },
 *   { p_id: "fert2", p_n_rt: 200, p_p_rt: 0, p_k_rt: 60, p_n_wc: 1.0, p_cu_rt: 5, p_zn_rt: 3 },
 * ];
 *
 * const result = calculateDose({ applications, fertilizers });
 * console.log(result.dose);
 * // Expected output: { p_dose_n: 20, p_dose_nw: 15, p_dose_p: 5, p_dose_k: 6, p_dose_s: 2, p_dose_mg: 1, ... }
 * console.log(result.applications);
 * // Expected output: [ { p_app_id: "app1", p_dose_n: 10, ... }, { p_app_id: "app2", p_dose_n: 10, ... } ]
 * ```
 */
export function calculateDose({
    applications,
    fertilizers,
}: {
    applications: BaseFertilizerApplication[]
    fertilizers: Fertilizer[]
}): { dose: Dose; applications: Dose[] } {
    if (applications.some((app) => (app.p_app_amount ?? 0) < 0)) {
        throw new Error("Application amounts must be non-negative")
    }

    const nutrientRates = [
        "p_n_rt",
        "p_p_rt",
        "p_k_rt",
        "p_eoc",
        "p_s_rt",
        "p_mg_rt",
        "p_ca_rt",
        "p_na_rt",
        "p_cu_rt",
        "p_zn_rt",
        "p_co_rt",
        "p_mn_rt",
        "p_mo_rt",
        "p_b_rt",
    ]
    const getNutrientRate = (fert: Fertilizer, rate: string): number | null => {
        return fert[rate as keyof Fertilizer] as number | null
    }
    if (
        fertilizers.some((fert) =>
            nutrientRates.some((rate) => {
                const value = getNutrientRate(fert, rate)
                return value !== null && value < 0
            }),
        )
    ) {
        throw new Error("Nutrient rates must be non-negative")
    }

    const initialDose: Dose = {
        p_dose_n: 0,
        p_dose_nw: 0,
        p_dose_p: 0,
        p_dose_k: 0,
        p_dose_eoc: 0,
        p_dose_s: 0,
        p_dose_mg: 0,
        p_dose_ca: 0,
        p_dose_na: 0,
        p_dose_cu: 0,
        p_dose_zn: 0,
        p_dose_co: 0,
        p_dose_mn: 0,
        p_dose_mo: 0,
        p_dose_b: 0,
    }

    const totalDose = { ...initialDose }
    const applicationDoses: Dose[] = []

    for (const application of applications) {
        const fertilizer = fertilizers.find((f) => f.p_id === application.p_id)
        if (!fertilizer) {
            throw new Error(
                `Fertilizer ${application.p_id} not found for application ${application.p_app_id}`,
            )
        }
        const currentDose = { ...initialDose, p_app_id: application.p_app_id }

        const amount = application.p_app_amount ?? 0
        currentDose.p_dose_n = amount * ((fertilizer.p_n_rt ?? 0) / 1000)
        currentDose.p_dose_nw = currentDose.p_dose_n * (fertilizer.p_n_wc ?? 1)
        currentDose.p_dose_p = amount * ((fertilizer.p_p_rt ?? 0) / 1000)
        currentDose.p_dose_k = amount * ((fertilizer.p_k_rt ?? 0) / 1000)
        currentDose.p_dose_eoc = amount * ((fertilizer.p_eoc ?? 0) / 1000)
        currentDose.p_dose_s = amount * ((fertilizer.p_s_rt ?? 0) / 1000)
        currentDose.p_dose_mg = amount * ((fertilizer.p_mg_rt ?? 0) / 1000)
        currentDose.p_dose_ca = amount * ((fertilizer.p_ca_rt ?? 0) / 1000)
        currentDose.p_dose_na = amount * ((fertilizer.p_na_rt ?? 0) / 1000000)
        currentDose.p_dose_cu = amount * ((fertilizer.p_cu_rt ?? 0) / 1000000)
        currentDose.p_dose_zn = amount * ((fertilizer.p_zn_rt ?? 0) / 1000000)
        currentDose.p_dose_co = amount * ((fertilizer.p_co_rt ?? 0) / 1000000)
        currentDose.p_dose_mn = amount * ((fertilizer.p_mn_rt ?? 0) / 1000000)
        currentDose.p_dose_mo = amount * ((fertilizer.p_mo_rt ?? 0) / 1000000)
        currentDose.p_dose_b = amount * ((fertilizer.p_b_rt ?? 0) / 1000000)

        applicationDoses.push(currentDose)
        for (const key of Object.keys(totalDose) as NumericDoseKeys[]) {
            totalDose[key] += currentDose[key]
        }
    }

    return {
        dose: totalDose,
        applications: applicationDoses,
    }
}
