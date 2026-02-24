import type { FdmServerType } from "@nmi-agro/fdm-core"
import {
    addFarm,
    addFertilizer,
    addFertilizerApplication,
    addFertilizerToCatalogue,
    addField,
    createFdmServer,
} from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, inject, it } from "vitest"
import { getDoseForField } from "./get-dose-field"

describe("getDoseForField", () => {
    let fdm: FdmServerType
    let b_id_farm: string
    let b_id: string
    let p_id: string
    let p_id_catalogue: string
    let principal_id: string
    beforeEach(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)
        principal_id = "test-user"
    })
    it("should calculate the correct dose for a field with a single application", async () => {
        b_id_farm = await addFarm(
            fdm,
            principal_id,
            "test farm",
            "1234567890",
            "test address",
            "1234AB",
        )
        b_id = await addField(
            fdm,
            principal_id,
            b_id_farm,
            "test field",
            "1",
            {
                type: "Polygon",
                coordinates: [
                    [
                        [30, 10],
                        [40, 40],
                        [20, 40],
                        [10, 20],
                        [30, 10],
                    ],
                ],
            },
            new Date(),
            "nl_02",
        )
        p_id_catalogue = await addFertilizerToCatalogue(
            fdm,
            principal_id,
            b_id_farm,
            {
                p_name_nl: "",
                p_name_en: "",
                p_description: "",
                p_dm: 0,
                p_density: 0,
                p_om: 0,
                p_a: 0,
                p_hc: 0,
                p_eom: 0,
                p_eoc: 0,
                p_c_rt: 0,
                p_c_of: 0,
                p_c_if: 0,
                p_c_fr: 0,
                p_cn_of: 0,
                p_n_rt: 20,
                p_n_if: 0,
                p_n_of: 0,
                p_n_wc: 0,
                p_p_rt: 10,
                p_k_rt: 5,
                p_mg_rt: 0,
                p_ca_rt: 0,
                p_ne: 0,
                p_s_rt: 0,
                p_s_wc: 0,
                p_cu_rt: 0,
                p_zn_rt: 0,
                p_na_rt: 0,
                p_si_rt: 0,
                p_b_rt: 0,
                p_mn_rt: 0,
                p_ni_rt: 0,
                p_fe_rt: 0,
                p_mo_rt: 0,
                p_co_rt: 0,
                p_as_rt: 0,
                p_cd_rt: 0,
                p_pb_rt: 0,
                p_hg_rt: 0,
                p_cl_rt: 0,
                p_type: "manure",
                p_app_method_options: undefined,
                p_no3_rt: undefined,
                p_nh4_rt: undefined,
                p_cr_rt: undefined,
                p_cr_vi: undefined,
                p_ef_nh3: undefined,
                p_type_rvo: undefined,
            },
        )
        p_id = await addFertilizer(
            fdm,
            principal_id,
            p_id_catalogue,
            b_id_farm,
            1000,
            new Date(),
        )
        await addFertilizerApplication(
            fdm,
            principal_id,
            b_id,
            p_id,
            100,
            undefined,
            new Date(),
        )

        const expectedResult = {
            p_dose_n: 2,
            p_dose_nw: 0,
            p_dose_p: 1,
            p_dose_k: 0.5,
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
        expect(await getDoseForField({ fdm, principal_id, b_id })).toEqual(
            expectedResult,
        )
    })

    it("should return 0 dose when no applications are found", async () => {
        b_id_farm = await addFarm(
            fdm,
            principal_id,
            "test farm",
            "1234567890",
            "test address",
            "1234AB",
        )
        b_id = await addField(
            fdm,
            principal_id,
            b_id_farm,
            "test field",
            "1",
            {
                type: "Polygon",
                coordinates: [
                    [
                        [30, 10],
                        [40, 40],
                        [20, 40],
                        [10, 20],
                        [30, 10],
                    ],
                ],
            },
            new Date(),
            "nl_02",
        )

        const expectedResult = {
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
        expect(await getDoseForField({ fdm, principal_id, b_id })).toEqual(
            expectedResult,
        )
    })
})
