import type { Timeframe } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import { buildDynaRequest, buildNSupplyRequest } from "./builders"

const baseField = {
    b_id: "field-1",
    b_centroid: [5.0, 52.0] as [number, number],
    b_area: 5,
}
const soilData = { a_som_loi: 3.5, b_soiltype_agr: "clay" }
const timeframe2025: Timeframe = {
    start: new Date("2025-01-01"),
    end: new Date("2025-12-31"),
}

describe("buildDynaRequest – rotation building", () => {
    it("includes a cultivation that started in the requested year", () => {
        const cultivations = [
            {
                b_lu: "cult-1",
                b_lu_catalogue: "bwt",
                b_lu_start: new Date("2025-03-01"),
                b_lu_end: new Date("2025-10-01"),
                b_lu_croprotation: "main",
                m_cropresidue: false,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "arable",
            timeframe2025,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            year: number
            b_lu: string
        }[]
        expect(rotation).toHaveLength(1)
        expect(rotation[0].year).toBe(2025)
        expect(rotation[0].b_lu).toBe("bwt")
    })

    it("includes a cultivation that started in a prior year but is still active in the requested year", () => {
        const cultivations = [
            {
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2024-04-01"),
                b_lu_end: new Date("2025-11-30"),
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "dairy",
            timeframe2025,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            year: number
            b_lu: string
        }[]
        expect(rotation).toHaveLength(1)
        expect(rotation[0].year).toBe(2025)
        expect(rotation[0].b_lu).toBe("grs")
    })

    it("includes a cultivation with no end date started before the requested year", () => {
        const cultivations = [
            {
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2023-01-01"),
                b_lu_end: null,
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "dairy",
            timeframe2025,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            year: number
            b_lu: string
        }[]
        expect(rotation).toHaveLength(1)
        expect(rotation[0].b_lu).toBe("grs")
    })

    it("excludes a cultivation that ended before the requested year", () => {
        const cultivations = [
            {
                b_lu_catalogue: "bwt",
                b_lu_start: new Date("2023-03-01"),
                b_lu_end: new Date("2023-10-01"),
                b_lu_croprotation: "main",
                m_cropresidue: false,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "arable",
            timeframe2025,
        )
        const rotation = (result.field as Record<string, unknown>)
            .rotation as unknown[]
        // Falls back to the empty fallback entry (no b_lu)
        expect(rotation).toHaveLength(1)
        expect((rotation[0] as Record<string, unknown>).b_lu).toBeUndefined()
    })

    it("only produces a single rotation entry for the requested year even when cultivations span multiple years", () => {
        const cultivations = [
            {
                b_lu_catalogue: "bwt",
                b_lu_start: new Date("2024-03-01"),
                b_lu_end: new Date("2024-10-01"),
                b_lu_croprotation: "main",
                m_cropresidue: false,
            },
            {
                b_lu_catalogue: "uib",
                b_lu_start: new Date("2025-04-01"),
                b_lu_end: new Date("2025-09-15"),
                b_lu_croprotation: "main",
                m_cropresidue: false,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "arable",
            timeframe2025,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            year: number
            b_lu: string
        }[]
        // Only 2025 entry is produced — 2024 cultivation is excluded (ended before 2025)
        expect(rotation).toHaveLength(1)
        expect(rotation[0].year).toBe(2025)
        expect(rotation[0].b_lu).toBe("uib")
    })

    it("uses May 15th rule to pick main crop for a multi-year cultivation overlapping with a short crop in the same year", () => {
        // Grass started 2024, still active May 15 2025 → chosen as main crop
        // Catch crop starts after May 15 and becomes green manure
        const cultivations = [
            {
                b_lu: "cult-grs",
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2024-04-01"),
                b_lu_end: new Date("2025-09-30"),
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
            {
                b_lu: "cult-cc",
                b_lu_catalogue: "phc",
                b_lu_start: new Date("2025-10-01"),
                b_lu_end: new Date("2025-12-01"),
                b_lu_croprotation: "catchcrop",
                m_cropresidue: null,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "dairy",
            timeframe2025,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            year: number
            b_lu: string
            b_lu_green?: string
        }[]
        expect(rotation).toHaveLength(1)
        expect(rotation[0].b_lu).toBe("grs")
        expect(rotation[0].b_lu_green).toBe("phc")
    })
})

describe("buildDynaRequest – harvests", () => {
    it("uses actual harvest records from harvestsByBlu when provided", () => {
        const cultivations = [
            {
                b_lu: "cult-grass",
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2024-10-15"),
                b_lu_end: null,
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
        ]
        const harvestsByBlu = new Map([
            [
                "cult-grass",
                [
                    {
                        b_lu_harvest_date: new Date("2025-05-10"),
                        b_lu_yield: 3200,
                    },
                    {
                        b_lu_harvest_date: new Date("2025-07-01"),
                        b_lu_yield: 2800,
                    },
                    {
                        b_lu_harvest_date: new Date("2025-09-15"),
                        b_lu_yield: 2600,
                    },
                ],
            ],
        ])
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "dairy",
            timeframe2025,
            undefined,
            harvestsByBlu,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            harvests: { b_date_harvest: string; b_lu_yield: number }[]
        }[]
        expect(rotation).toHaveLength(1)
        expect(rotation[0].harvests).toHaveLength(3)
        expect(rotation[0].harvests[0].b_date_harvest).toBe("2025-05-10")
        expect(rotation[0].harvests[0].b_lu_yield).toBe(3200)
        expect(rotation[0].harvests[2].b_date_harvest).toBe("2025-09-15")
    })

    it("falls back to b_lu_end harvest when no harvest records are in the map", () => {
        const cultivations = [
            {
                b_lu: "cult-wheat",
                b_lu_catalogue: "bwt",
                b_lu_start: new Date("2025-03-01"),
                b_lu_end: new Date("2025-08-15"),
                b_lu_croprotation: "main",
                m_cropresidue: false,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "arable",
            timeframe2025,
            [{ b_lu_catalogue: "bwt", b_lu_yield: 1800 }],
            new Map(),
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            harvests: { b_date_harvest: string; b_lu_yield?: number }[]
        }[]
        expect(rotation[0].harvests).toHaveLength(1)
        expect(rotation[0].harvests[0].b_date_harvest).toBe("2025-08-15")
        expect(rotation[0].harvests[0].b_lu_yield).toBe(1800)
    })

    it("uses catalogue yield as fallback when harvest record has no yield", () => {
        const cultivations = [
            {
                b_lu: "cult-grass",
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2024-10-15"),
                b_lu_end: null,
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
        ]
        const harvestsByBlu = new Map([
            [
                "cult-grass",
                [
                    {
                        b_lu_harvest_date: new Date("2025-05-10"),
                        b_lu_yield: null,
                    },
                ],
            ],
        ])
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "dairy",
            timeframe2025,
            [{ b_lu_catalogue: "grs", b_lu_yield: 1838 }],
            harvestsByBlu,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            harvests: { b_date_harvest: string; b_lu_yield?: number }[]
        }[]
        expect(rotation[0].harvests[0].b_lu_yield).toBe(1838)
    })

    it("produces empty harvests when no records and no end date (ongoing cultivation)", () => {
        const cultivations = [
            {
                b_lu: "cult-grass",
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2024-10-15"),
                b_lu_end: null,
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "dairy",
            timeframe2025,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            harvests: unknown[]
        }[]
        expect(rotation[0].harvests).toHaveLength(0)
    })
})

describe("buildDynaRequest – fertilizers", () => {
    const cultivations = [
        {
            b_lu: "cult-1",
            b_lu_catalogue: "bwt",
            b_lu_start: new Date("2025-03-01"),
            b_lu_end: new Date("2025-08-15"),
            b_lu_croprotation: "main",
            m_cropresidue: true,
        },
    ]

    it("includes amendments only for the requested year", () => {
        const fertilizers = [
            {
                p_id: "fert-1",
                p_n_rt: 120,
                p_n_if: 0.5,
                p_n_of: 0.3,
                p_n_wc: 0.1,
                p_p_rt: 30,
                p_k_rt: 50,
                p_dm: 25,
                p_om: 10,
                p_date: new Date("2025-04-01"),
                p_dose: 20,
                p_app_method: "injection",
            },
            {
                p_id: "fert-2",
                p_n_rt: 80,
                p_n_if: null,
                p_n_of: null,
                p_n_wc: null,
                p_p_rt: null,
                p_k_rt: null,
                p_dm: null,
                p_om: null,
                p_date: new Date("2024-04-01"), // prior year – excluded from amendments
                p_dose: 15,
                p_app_method: null,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            fertilizers,
            "arable",
            timeframe2025,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            amendments: { p_id: string; p_app_method: string }[]
        }[]
        expect(rotation[0].amendments).toHaveLength(1)
        expect(rotation[0].amendments[0].p_id).toBe("fert-1")
        expect(rotation[0].amendments[0].p_app_method).toBe("injection")
    })

    it("defaults p_app_method to broadcasting when null", () => {
        const fertilizers = [
            {
                p_id: "fert-3",
                p_n_rt: 50,
                p_date: new Date("2025-05-01"),
                p_dose: 10,
                p_app_method: null,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            fertilizers,
            "arable",
            timeframe2025,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            amendments: { p_app_method: string }[]
        }[]
        expect(rotation[0].amendments[0].p_app_method).toBe("broadcasting")
    })

    it("deduplicates fertilizer_properties by p_id", () => {
        const fertilizers = [
            {
                p_id: "fert-A",
                p_n_rt: 100,
                p_date: new Date("2025-04-01"),
                p_dose: 10,
                p_app_method: "broadcasting",
            },
            {
                p_id: "fert-A",
                p_n_rt: 100,
                p_date: new Date("2025-05-01"),
                p_dose: 15,
                p_app_method: "broadcasting",
            },
            {
                p_id: "fert-B",
                p_n_rt: 60,
                p_date: new Date("2025-06-01"),
                p_dose: 12,
                p_app_method: "broadcasting",
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            fertilizers,
            "arable",
            timeframe2025,
        )
        const props = result.fertilizer_properties as { p_id: string }[]
        expect(props).toHaveLength(2)
        expect(props.map((p) => p.p_id)).toEqual(["fert-A", "fert-B"])
    })

    it("includes all optional nutrient properties in fertilizer_properties", () => {
        const fertilizers = [
            {
                p_id: "fert-full",
                p_n_rt: 120,
                p_n_if: 0.5,
                p_n_of: 0.3,
                p_n_wc: 0.1,
                p_p_rt: 30,
                p_k_rt: 50,
                p_dm: 25,
                p_om: 10,
                p_date: new Date("2025-04-01"),
                p_dose: 20,
                p_app_method: "injection",
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            fertilizers,
            "arable",
            timeframe2025,
        )
        const props = result.fertilizer_properties as Record<string, unknown>[]
        expect(props[0]).toMatchObject({
            p_n_if: 0.5,
            p_n_of: 0.3,
            p_n_wc: 0.1,
            p_p_rt: 30,
            p_k_rt: 50,
            p_dm: 25,
            p_om: 10,
        })
    })

    it("returns null for fertilizer_properties when no fertilizers provided", () => {
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "arable",
            timeframe2025,
        )
        expect(result.fertilizer_properties).toBeNull()
    })
})

describe("buildDynaRequest – crop_properties and misc", () => {
    const cultivations = [
        {
            b_lu: "cult-1",
            b_lu_catalogue: "bwt",
            b_lu_start: new Date("2025-03-01"),
            b_lu_end: new Date("2025-08-15"),
            b_lu_croprotation: "main",
            m_cropresidue: true,
        },
    ]

    it("includes crop_properties when provided", () => {
        const cropProperties = [
            {
                b_lu_catalogue: "bwt",
                b_lu_yield: 1800,
                b_lu_n_harvestable: 20,
                b_lu_n_residue: 5,
            },
        ]
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "arable",
            timeframe2025,
            cropProperties,
        )
        const props = result.crop_properties as {
            b_lu: string
            b_lu_yield: number
        }[]
        expect(props).toHaveLength(1)
        expect(props[0].b_lu).toBe("bwt")
        expect(props[0].b_lu_yield).toBe(1800)
    })

    it("returns null for crop_properties when not provided", () => {
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "arable",
            timeframe2025,
        )
        expect(result.crop_properties).toBeNull()
    })

    it("defaults sector to arable when farmSector is empty string", () => {
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "",
            timeframe2025,
        )
        expect((result.farm as { sector: string }).sector).toBe("arable")
    })

    it("omits b_id from field when not provided", () => {
        const fieldNoId = {
            b_centroid: [5.0, 52.0] as [number, number],
            b_area: 5,
        }
        const result = buildDynaRequest(
            fieldNoId,
            soilData,
            cultivations,
            [],
            "arable",
            timeframe2025,
        )
        expect((result.field as Record<string, unknown>).b_id).toBeUndefined()
    })

    it("includes m_cropresidue on rotation entry when set", () => {
        const result = buildDynaRequest(
            baseField,
            soilData,
            cultivations,
            [],
            "arable",
            timeframe2025,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as {
            m_cropresidue: boolean
        }[]
        expect(rotation[0].m_cropresidue).toBe(true)
    })

    it("omits a_lat/a_lon when no centroid provided", () => {
        const fieldNoCentroid = { b_id: "f1", b_area: 5 }
        const result = buildDynaRequest(
            fieldNoCentroid,
            soilData,
            cultivations,
            [],
            "arable",
            timeframe2025,
        )
        const fieldObj = result.field as Record<string, unknown>
        expect(fieldObj.a_lat).toBeUndefined()
        expect(fieldObj.a_lon).toBeUndefined()
    })
})

describe("buildNSupplyRequest", () => {
    const timeframe2025: Timeframe = {
        start: new Date("2025-01-01"),
        end: new Date("2025-12-31"),
    }

    it("builds a basic nsupply request with all fields", () => {
        const field = {
            b_centroid: [5.585, 53.288] as [number, number],
            b_area: 10,
        }
        const soilData = {
            a_som_loi: 3.5,
            a_clay_mi: 10,
            a_silt_mi: 20,
            a_sand_mi: 70,
            a_c_of: 18,
            a_cn_fr: 12,
            a_n_rt: 2000,
            a_n_pmn: 30,
            b_soiltype_agr: "sand",
            a_depth_lower: 0.3,
        }
        const cultivations = [
            {
                b_lu_catalogue: "nl_256",
                b_lu_start: new Date("2025-04-01"),
                b_lu_end: new Date("2025-09-01"),
                b_lu_croprotation: "main",
            },
        ]

        const result = buildNSupplyRequest(
            field,
            soilData,
            cultivations,
            "minip",
            timeframe2025,
        )

        expect(result.d_n_supply_method).toBe("minip")
        expect(result.d_start).toBe("2025-01-01")
        expect(result.d_end).toBe("2025-12-31")
        expect(result.a_lat).toBe(53.288)
        expect(result.a_lon).toBe(5.585)
        expect(result.b_lu_brp).toBe(256)
        expect(result.a_som_loi).toBe(3.5)
        expect(result.a_clay_mi).toBe(10)
        expect(result.b_soiltype_agr).toBe("sand")
        expect(result.a_depth).toBe(0.3)
    })

    it("omits a_lat/a_lon when no centroid", () => {
        const result = buildNSupplyRequest({}, {}, [], "minip", timeframe2025)
        expect(result.a_lat).toBeUndefined()
        expect(result.a_lon).toBeUndefined()
    })

    it("omits b_lu_brp when no cultivations", () => {
        const result = buildNSupplyRequest({}, {}, [], "minip", timeframe2025)
        expect(result.b_lu_brp).toBeUndefined()
    })

    it("omits b_lu_brp when catalogue code cannot be parsed as integer", () => {
        const cultivations = [
            {
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2025-05-01"),
                b_lu_end: null,
                b_lu_croprotation: "main",
            },
        ]
        const result = buildNSupplyRequest(
            {},
            {},
            cultivations,
            "minip",
            timeframe2025,
        )
        expect(result.b_lu_brp).toBeUndefined()
    })

    it("defaults a_depth to 0.3 when a_depth_lower is not in soilData", () => {
        const result = buildNSupplyRequest({}, {}, [], "minip", timeframe2025)
        expect(result.a_depth).toBe(0.3)
    })

    it("uses a_depth_lower value from soilData when provided", () => {
        const result = buildNSupplyRequest(
            {},
            { a_depth_lower: 0.25 },
            [],
            "minip",
            timeframe2025,
        )
        expect(result.a_depth).toBe(0.25)
    })

    it("omits d_start and d_end when timeframe has no dates", () => {
        const result = buildNSupplyRequest({}, {}, [], "minip", {
            start: undefined,
            end: undefined,
        })
        expect(result.d_start).toBeUndefined()
        expect(result.d_end).toBeUndefined()
    })

    it("skips null/undefined soil params", () => {
        const result = buildNSupplyRequest(
            {},
            { a_som_loi: null, a_clay_mi: undefined, a_n_rt: 1000 },
            [],
            "minip",
            timeframe2025,
        )
        expect(result.a_som_loi).toBeUndefined()
        expect(result.a_clay_mi).toBeUndefined()
        expect(result.a_n_rt).toBe(1000)
    })
})
