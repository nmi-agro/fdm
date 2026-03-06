import type { Fertilizer, FertilizerApplication } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import { calculateDose } from "./calculate-dose"

const initialDose = {
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

const baseApplication: FertilizerApplication = {
    p_app_id: "app1",
    p_id_catalogue: "fert1",
    p_app_amount: 100,
    p_id: "fert1",
    p_name_nl: null,
    p_app_method: null,
    p_app_date: new Date("2025-03-15"),
}

const baseFertilizer: Fertilizer = {
    p_id: "fert1",
    p_id_catalogue: "fert1",
    p_n_rt: 100,
    p_p_rt: 50,
    p_k_rt: 30,
    p_n_wc: 0.5,
    p_s_rt: 20,
    p_mg_rt: 15,
    p_eom: 0,
    p_eoc: 0,
    p_ca_rt: 25,
    p_na_rt: 5,
    p_cu_rt: 2,
    p_zn_rt: 3,
    p_co_rt: 1,
    p_mn_rt: 4,
    p_mo_rt: 0.5,
    p_b_rt: 1.5,
    p_name_nl: null,
    p_name_en: null,
    p_description: null,
    p_app_method_options: null,
    p_app_amount: null,
    p_date_acquiring: null,
    p_picking_date: null,
    p_n_if: null,
    p_n_of: null,
    p_no3_rt: null,
    p_nh4_rt: null,
    p_ne: null,
    p_s_wc: null,
    p_si_rt: null,
    p_ni_rt: null,
    p_fe_rt: null,
    p_as_rt: null,
    p_cd_rt: null,
    p_cr_rt: null,
    p_cr_vi: null,
    p_pb_rt: null,
    p_hg_rt: null,
    p_cl_rt: null,
    p_ef_nh3: null,
    p_type: null,
    p_type_rvo: null,
}

describe("calculateDose", () => {
    it("should calculate all nutrient doses correctly", () => {
        const applications: FertilizerApplication[] = [
            {
                ...baseApplication,
            },
            {
                ...baseApplication,
                p_app_id: "app2",
                p_id_catalogue: "fert2",
                p_id: "fert2", // Fixed: p_id should match the fertilizer p_id
                p_app_amount: 50,
            },
        ]

        const fertilizers: Fertilizer[] = [
            {
                ...baseFertilizer,
            },
            {
                ...baseFertilizer,
                p_id: "fert2",
                p_n_rt: 200,
                p_p_rt: 0,
                p_k_rt: 60,
                p_n_wc: 1.0,
                p_s_rt: 10,
                p_mg_rt: 5,
                p_ca_rt: 15,
                p_na_rt: 2,
                p_cu_rt: 1,
                p_zn_rt: 2,
                p_co_rt: 0.5,
                p_mn_rt: 2,
                p_mo_rt: 0.2,
                p_b_rt: 0.5,
            },
        ]

        const result = calculateDose({ applications, fertilizers })

        expect(result.dose.p_dose_n).toBeCloseTo(20)
        expect(result.dose.p_dose_nw).toBeCloseTo(15)
        expect(result.dose.p_dose_p).toBeCloseTo(5)
        expect(result.dose.p_dose_k).toBeCloseTo(6)
        expect(result.dose.p_dose_s).toBeCloseTo(2.5)
        expect(result.dose.p_dose_mg).toBeCloseTo(1.75)
        expect(result.dose.p_dose_ca).toBeCloseTo(3.25)
        expect(result.dose.p_dose_na).toBeCloseTo(0.000006)
        expect(result.dose.p_dose_cu).toBeCloseTo(0.00025)
        expect(result.dose.p_dose_zn).toBeCloseTo(0.0004)
        expect(result.dose.p_dose_co).toBeCloseTo(0.000125)
        expect(result.dose.p_dose_mn).toBeCloseTo(0.0005)
        expect(result.dose.p_dose_mo).toBeCloseTo(0.00006)
        expect(result.dose.p_dose_b).toBeCloseTo(0.000175)

        expect(result.applications).toHaveLength(2)
        expect(result.applications[0].p_dose_n).toBeCloseTo(10)
        expect(result.applications[1].p_dose_n).toBeCloseTo(10)
    })

    it("should handle zero application amounts correctly", () => {
        const applications: FertilizerApplication[] = [
            {
                ...baseApplication,
                p_app_amount: 0,
            },
        ]
        const fertilizers: Fertilizer[] = [
            {
                ...baseFertilizer,
            },
        ]
        const { dose } = calculateDose({ applications, fertilizers })
        expect(dose).toEqual(initialDose)
    })

    it("should handle zero nutrient rates correctly", () => {
        const applications: FertilizerApplication[] = [
            {
                ...baseApplication,
            },
        ]
        const fertilizers: Fertilizer[] = [
            {
                ...baseFertilizer,
                p_n_rt: 0,
                p_p_rt: 0,
                p_k_rt: 0,
                p_n_wc: 0,
                p_s_rt: 0,
                p_mg_rt: 0,
                p_ca_rt: 0,
                p_na_rt: 0,
                p_cu_rt: 0,
                p_zn_rt: 0,
                p_co_rt: 0,
                p_mn_rt: 0,
                p_mo_rt: 0,
                p_b_rt: 0,
            },
        ]
        const { dose } = calculateDose({ applications, fertilizers })
        expect(dose).toEqual(initialDose)
    })

    it("should throw an error for negative application amounts", () => {
        const applications: FertilizerApplication[] = [
            {
                ...baseApplication,
                p_app_amount: -100,
            },
        ]
        const fertilizers: Fertilizer[] = [{ ...baseFertilizer }]
        expect(() => calculateDose({ applications, fertilizers })).toThrow(
            "Application amounts must be non-negative",
        )
    })

    it("should throw an error for negative nutrient rates", () => {
        const applications: FertilizerApplication[] = [
            {
                ...baseApplication,
            },
        ]
        const fertilizers: Fertilizer[] = [
            {
                ...baseFertilizer,
                p_n_rt: -100,
            },
        ]
        expect(() => calculateDose({ applications, fertilizers })).toThrow(
            "Nutrient rates must be non-negative",
        )
    })

    it("should throw an error for missing fertilizers", () => {
        const applications: FertilizerApplication[] = [
            {
                ...baseApplication,
                p_id_catalogue: "fert_missing",
                p_id: "fert_missing",
            },
        ]
        const fertilizers: Fertilizer[] = [{ ...baseFertilizer }]
        expect(() => calculateDose({ applications, fertilizers })).toThrow(
            "Fertilizer fert_missing not found for application app1",
        )
    })

    it("should handle empty applications array", () => {
        const { dose, applications } = calculateDose({
            applications: [],
            fertilizers: [{ ...baseFertilizer }],
        })
        expect(dose).toEqual(initialDose)
        expect(applications).toHaveLength(0)
    })

    it("should throw an error for empty fertilizers array", () => {
        const applications: FertilizerApplication[] = [
            {
                ...baseApplication,
            },
        ]
        expect(() =>
            calculateDose({
                applications,
                fertilizers: [],
            }),
        ).toThrow("Fertilizer fert1 not found for application app1")
    })
})
