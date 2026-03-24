import { describe, it, expect, vi, beforeEach } from "vitest"
import { processRvoImport } from "./process"
import {
    addField,
    updateField,
    removeField,
    addCultivation,
    removeCultivation,
    getDefaultDatesOfCultivation,
} from "@nmi-agro/fdm-core"
import { RvoImportReviewStatus, type RvoImportReviewItem } from "./types"

// Mock fdm-core
vi.mock("@nmi-agro/fdm-core", () => ({
    addField: vi.fn(),
    updateField: vi.fn(),
    removeField: vi.fn(),
    addCultivation: vi.fn(),
    removeCultivation: vi.fn(),
    getDefaultDatesOfCultivation: vi.fn(),
    acquiringMethodOptions: [
        { value: "nl_01", label: "Eigendom" },
        { value: "nl_02", label: "Reguliere pacht" },
        { value: "nl_03", label: "In gebruik van een terreinbeherende organisatie" },
        { value: "nl_04", label: "Tijdelijk gebruik in het kader van landinrichting" },
        { value: "nl_07", label: "Overige exploitatievormen" },
        { value: "nl_09", label: "Erfpacht" },
        { value: "nl_10", label: "Pacht van geringe oppervlakten" },
        { value: "nl_11", label: "Natuurpacht" },
        { value: "nl_12", label: "Geliberaliseerde pacht, langer dan 6 jaar" },
        { value: "nl_13", label: "Geliberaliseerde pacht, 6 jaar of korter" },
        { value: "nl_61", label: "Reguliere pacht kortlopend" },
        { value: "nl_63", label: "Teeltpacht" },
        { value: "unknown", label: "Onbekend" },
    ],
}))

describe("processRvoImport", () => {
    const mockFdm = {
        transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockFdm)),
    } as any
    const principalId = "user-1"
    const farmId = "farm-1"
    const year = 2025

    beforeEach(() => {
        vi.clearAllMocks()
        // Default mocks
        ;(getDefaultDatesOfCultivation as any).mockResolvedValue({
            b_lu_start: new Date(`${year}-01-01`),
            b_lu_end: new Date(`${year}-12-31`),
        })
        ;(addField as any).mockResolvedValue("new-field-id")
    })

    it("should process ADD_REMOTE action", async () => {
        const item: RvoImportReviewItem<any> = {
            status: RvoImportReviewStatus.NEW_REMOTE,
            rvoField: {
                type: "Feature",
                geometry: { type: "Polygon", coordinates: [] },
                properties: {
                    CropFieldID: "rvo-1",
                    CropFieldDesignator: "New Field",
                    BeginDate: "2025-01-01",
                    UseTitleCode: "01",
                    CropTypeCode: "101",
                    CropFieldVersion: "1",
                    Country: "NL",
                },
            },
            diffs: [],
        }
        const choices = { "rvo-1": "ADD_REMOTE" as const }
        const onFieldAdded = vi.fn()

        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [item],
            choices,
            year,
            onFieldAdded,
        )

        expect(addField).toHaveBeenCalledWith(
            mockFdm,
            principalId,
            farmId,
            "New Field",
            "rvo-1",
            expect.anything(), // geometry
            expect.any(Date), // start
            "nl_01",
            undefined, // end
            undefined, // b_bufferstrip (no mestData in test)
        )
        expect(addCultivation).toHaveBeenCalled()
        expect(onFieldAdded).toHaveBeenCalledWith(
            mockFdm,
            "new-field-id",
            expect.anything(),
        )
    })

    it("should process UPDATE_FROM_REMOTE action", async () => {
        const item: RvoImportReviewItem<any> = {
            status: RvoImportReviewStatus.CONFLICT,
            localField: {
                b_id: "local-1",
                b_name: "Old Name",
            },
            rvoField: {
                type: "Feature",
                geometry: { type: "Polygon", coordinates: [] },
                properties: {
                    CropFieldID: "rvo-1",
                    CropFieldDesignator: "New Name",
                    BeginDate: "2025-01-01",
                    UseTitleCode: "01",
                    CropTypeCode: "101",
                    CropFieldVersion: "1",
                    Country: "NL",
                },
            },
            diffs: ["b_name"],
        }
        const choices = { "local-1": "UPDATE_FROM_REMOTE" as const }

        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [item],
            choices,
            year,
        )

        expect(updateField).toHaveBeenCalledWith(
            mockFdm,
            principalId,
            "local-1",
            "New Name",
            "rvo-1",
            expect.anything(),
            expect.any(Date),
            "nl_01",
            undefined,
            undefined, // b_bufferstrip (no mestData in test)
        )
        // No cultivation change implies no cultivation update call unless localCultivation differs
        expect(removeCultivation).not.toHaveBeenCalled()
        expect(addCultivation).not.toHaveBeenCalled()
    })

    it("should process UPDATE_FROM_REMOTE action with cultivation change", async () => {
        const item: RvoImportReviewItem<any> = {
            status: RvoImportReviewStatus.CONFLICT,
            localField: { b_id: "local-1" },
            localCultivation: {
                b_lu_catalogue: "nl_202", // Different from rvo 101
                b_lu: "cult-1",
            },
            rvoField: {
                type: "Feature",
                geometry: { type: "Polygon", coordinates: [] },
                properties: {
                    CropFieldID: "rvo-1",
                    CropFieldDesignator: "Name",
                    BeginDate: "2025-01-01",
                    UseTitleCode: "01",
                    CropTypeCode: "101",
                    CropFieldVersion: "1",
                    Country: "NL",
                },
            },
            diffs: ["b_lu_catalogue"],
        }
        const choices = { "local-1": "UPDATE_FROM_REMOTE" as const }

        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [item],
            choices,
            year,
        )

        expect(updateField).toHaveBeenCalled()
        expect(removeCultivation).toHaveBeenCalledWith(
            mockFdm,
            principalId,
            "cult-1",
        )
        expect(addCultivation).toHaveBeenCalledWith(
            mockFdm,
            principalId,
            "nl_101",
            "local-1",
            expect.any(Date),
            expect.any(Date),
        )
    })

    it("should process REMOVE_LOCAL action", async () => {
        const item: RvoImportReviewItem<any> = {
            status: RvoImportReviewStatus.NEW_LOCAL,
            localField: { b_id: "local-1" },
            diffs: [],
        }
        const choices = { "local-1": "REMOVE_LOCAL" as const }

        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [item],
            choices,
            year,
        )

        expect(removeField).toHaveBeenCalledWith(
            mockFdm,
            principalId,
            "local-1",
        )
    })

    it("should process CLOSE_LOCAL action", async () => {
        const item: RvoImportReviewItem<any> = {
            status: RvoImportReviewStatus.EXPIRED_LOCAL,
            localField: {
                b_id: "local-1",
                b_name: "Field 1",
                b_id_source: "rvo-1",
                b_geometry: {},
                b_start: new Date("2024-01-01"),
                b_acquiring_method: "purchase",
            },
            diffs: [],
        }
        const choices = { "local-1": "CLOSE_LOCAL" as const }

        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [item],
            choices,
            year,
        )

        // Should update field with end date = Dec 31st of previous year (2024)
        const expectedCloseDate = new Date(year - 1, 11, 31)
        expect(updateField).toHaveBeenCalledWith(
            mockFdm,
            principalId,
            "local-1",
            "Field 1",
            "rvo-1",
            {},
            item.localField?.b_start,
            "purchase",
            expectedCloseDate,
        )
    })

    it("should process CLOSE_LOCAL action even if b_start is a string", async () => {
        const item: RvoImportReviewItem<any> = {
            status: RvoImportReviewStatus.EXPIRED_LOCAL,
            localField: {
                b_id: "local-1",
                b_name: "Field 1",
                b_id_source: "rvo-1",
                b_geometry: {},
                b_start: "2024-01-01", // String date
                b_acquiring_method: "purchase",
            },
            diffs: [],
        }
        const choices = { "local-1": "CLOSE_LOCAL" as const }

        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [item],
            choices,
            year,
        )

        expect(updateField).toHaveBeenCalledWith(
            mockFdm,
            principalId,
            "local-1",
            "Field 1",
            "rvo-1",
            {},
            expect.any(Date), // Should convert to Date
            "purchase",
            expect.any(Date),
        )
    })

    it("should process KEEP_LOCAL action (do nothing)", async () => {
        const item: RvoImportReviewItem<any> = {
            status: RvoImportReviewStatus.CONFLICT,
            localField: { b_id: "local-1" },
            diffs: ["b_name"],
        }
        const choices = { "local-1": "KEEP_LOCAL" as const }

        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [item],
            choices,
            year,
        )

        expect(addField).not.toHaveBeenCalled()
        expect(updateField).not.toHaveBeenCalled()
        expect(removeField).not.toHaveBeenCalled()
    })

    it("should skip items with no action selected", async () => {
        const item: RvoImportReviewItem<any> = {
            status: RvoImportReviewStatus.NEW_REMOTE,
            rvoField: { properties: { CropFieldID: "rvo-1" } } as any,
            diffs: [],
        }
        // No choice provided for rvo-1
        const choices = {}

        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [item],
            choices,
            year,
        )

        expect(addField).not.toHaveBeenCalled()
        expect(updateField).not.toHaveBeenCalled()
        expect(removeField).not.toHaveBeenCalled()
    })

    it("should ignore actions when required fields are missing", async () => {
        // ADD_REMOTE without rvoField
        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [{ status: RvoImportReviewStatus.NEW_REMOTE, diffs: [] }],
            { unknown: "ADD_REMOTE" },
            year,
        )
        expect(addField).not.toHaveBeenCalled()

        // UPDATE_FROM_REMOTE without rvoField
        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [
                {
                    status: RvoImportReviewStatus.CONFLICT,
                    localField: { b_id: "l1" },
                    diffs: [],
                },
            ],
            { l1: "UPDATE_FROM_REMOTE" },
            year,
        )
        expect(updateField).not.toHaveBeenCalled()

        // REMOVE_LOCAL without localField
        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [{ status: RvoImportReviewStatus.NEW_LOCAL, diffs: [] }],
            { unknown: "REMOVE_LOCAL" },
            year,
        )
        expect(removeField).not.toHaveBeenCalled()

        // CLOSE_LOCAL without localField
        await processRvoImport(
            mockFdm,
            principalId,
            farmId,
            [{ status: RvoImportReviewStatus.EXPIRED_LOCAL, diffs: [] }],
            { unknown: "CLOSE_LOCAL" },
            year,
        )
        expect(updateField).not.toHaveBeenCalled()
    })
})
