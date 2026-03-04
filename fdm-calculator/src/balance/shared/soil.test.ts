import type { SoilAnalysis } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import type { SoilAnalysisPicked as NitrogenSoilAnalysisPicked } from "../nitrogen/types"
import type { SoilAnalysisPicked as OrganicMatterSoilAnalysisPicked } from "../organic-matter/types"
import { combineSoilAnalyses } from "./soil"

describe("combineSoilAnalyses", () => {
    const soilAnalyses: Partial<SoilAnalysis>[] = [
        {
            a_id: "soil1",
            b_sampling_date: new Date("2023-01-01"),
            a_c_of: 20,
            a_cn_fr: 10,
            a_density_sa: 1.2,
            a_n_rt: 3000,
            a_som_loi: 2,
            b_soiltype_agr: "dekzand",
            b_gwl_class: "II",
        },
        {
            a_id: "soil2",
            b_sampling_date: new Date("2023-01-05"),
            a_c_of: 22,
            a_cn_fr: 11,
            a_density_sa: 1.3,
            a_n_rt: 2000,
            a_som_loi: 3,
            b_soiltype_agr: "zeeklei",
            b_gwl_class: "II",
        },
        {
            a_id: "soil3",
            b_sampling_date: new Date("2022-12-01"),
            a_som_loi: 1.5,
        },
    ]

    it("should combine for nitrogen with estimation", () => {
        const result = combineSoilAnalyses<NitrogenSoilAnalysisPicked>(
            soilAnalyses,
            [
                "b_soiltype_agr",
                "a_n_rt",
                "a_c_of",
                "a_cn_fr",
                "a_density_sa",
                "a_som_loi",
                "b_gwl_class",
            ],
            true,
        )

        expect(result).toBeDefined()
        expect(result.a_c_of).toBe(22)
        expect(result.a_cn_fr).toBe(11)
        expect(result.a_density_sa).toBe(1.3)
        expect(result.a_n_rt).toBe(2000)
        expect(result.a_som_loi).toBe(3)
        expect(result.b_soiltype_agr).toBe("zeeklei")
    })

    it("should combine for organic matter without estimation", () => {
        const result = combineSoilAnalyses<OrganicMatterSoilAnalysisPicked>(
            soilAnalyses,
            ["a_som_loi", "a_density_sa"],
            false,
        )

        expect(result).toBeDefined()
        expect(result.a_som_loi).toBe(3)
        expect(result.a_density_sa).toBe(1.3)
        expect((result as any).a_c_of).toBeUndefined()
    })

    it("should throw an error if required parameters are missing", () => {
        const incompleteAnalyses = [
            {
                a_id: "soil1",
                b_sampling_date: new Date("2023-01-01"),
                a_som_loi: 2,
            },
        ]

        expect(() =>
            combineSoilAnalyses<OrganicMatterSoilAnalysisPicked>(
                incompleteAnalyses,
                ["a_som_loi", "a_density_sa"],
                false,
            ),
        ).toThrow("Missing required soil parameters: a_density_sa")
    })
})
