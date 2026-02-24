import { describe, expect, it } from "vitest";
import { calculateWaterSupplyBySom } from "./water-supply-by-som";

describe("calculateWaterSupplyBySom", () => {
    it("should return 0 if mineral content is 0", () => {
        const result = calculateWaterSupplyBySom({
            a_clay_mi: 0,
            a_sand_mi: 0,
            a_silt_mi: 0,
            a_som_loi: 3,
            b_som_potential: 4,
        });
        expect(result).toBe(0);
    });

    it("should return a positive value when SOM increases", () => {
        const result = calculateWaterSupplyBySom({
            a_clay_mi: 20,
            a_sand_mi: 40,
            a_silt_mi: 40,
            a_som_loi: 3,
            b_som_potential: 4,
        });
        expect(result).toBeGreaterThan(0);
    });

    it("should return a negative value when SOM decreases", () => {
        const result = calculateWaterSupplyBySom({
            a_clay_mi: 20,
            a_sand_mi: 40,
            a_silt_mi: 40,
            a_som_loi: 4,
            b_som_potential: 3,
        });
        expect(result).toBeLessThan(0);
    });

    it("should return 0 when SOM remains the same", () => {
        const result = calculateWaterSupplyBySom({
            a_clay_mi: 20,
            a_sand_mi: 40,
            a_silt_mi: 40,
            a_som_loi: 3,
            b_som_potential: 3,
        });
        expect(result).toBe(0);
    });

    it("should handle typical soil values", () => {
        // Values from a typical clay soil
        const result = calculateWaterSupplyBySom({
            a_clay_mi: 35,
            a_sand_mi: 15,
            a_silt_mi: 50,
            a_som_loi: 4.5,
            b_som_potential: 5.5,
        });
        // We expect some increase in water holding capacity
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(50); // Usually it's in the order of a few mm
    });
});
