import { describe, expect, it } from "vitest";
import { calculateNlvSupplyBySom } from "./nlv-supply-by-som";

describe("calculateNlvSupplyBySom", () => {
    it("should return a positive value when SOM increases", () => {
        const result = calculateNlvSupplyBySom({
            a_clay_mi: 20,
            a_cn_fr: 12,
            a_som_loi: 3,
            b_som_potential: 4,
        });
        expect(result).toBeGreaterThan(0);
    });

    it("should return a negative value when SOM decreases", () => {
        const result = calculateNlvSupplyBySom({
            a_clay_mi: 20,
            a_cn_fr: 12,
            a_som_loi: 4,
            b_som_potential: 3,
        });
        expect(result).toBeLessThan(0);
    });

    it("should return 0 change when SOM remains the same", () => {
        const result = calculateNlvSupplyBySom({
            a_clay_mi: 20,
            a_cn_fr: 12,
            a_som_loi: 3,
            b_som_potential: 3,
        });
        expect(result).toBe(0);
    });

    it("should handle typical soil values and return plausible NLV increase", () => {
        const result = calculateNlvSupplyBySom({
            a_clay_mi: 25,
            a_cn_fr: 10,
            a_som_loi: 4.0,
            b_som_potential: 5.0,
        });
        
        // The increase for 1% SOM is usually around 10-30 kg N/ha in these models
        expect(result).toBeGreaterThan(5);
        expect(result).toBeLessThan(100);
    });
});
