import type { NL2025NormsFillingInput } from "./nl/2025/filling/types"
import type { RegionKey } from "./nl/2025/value/types"
import type { NL2026NormsFillingInput } from "./nl/2026/filling/types"
import type { NormFilling } from "./nl/types"
import { calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2025/filling/dierlijke-mest-gebruiksnorm"
import { calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2025/filling/fosfaatgebruiksnorm"
import { calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNormWithRegion } from "./nl/2025/filling/stikstofgebruiksnorm"
import { calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2026/filling/dierlijke-mest-gebruiksnorm"
import { calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2026/filling/fosfaatgebruiksnorm"
import { calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm } from "./nl/2026/filling/renure-gebruiksnorm"
import { calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNormWithRegion } from "./nl/2026/filling/stikstofgebruiksnorm"

/** The fillings of the legal application norms of a single field, in kg per hectare. */
export type FertilizerApplicationFillings = {
  nitrogen: NormFilling
  manure: NormFilling
  phosphate: NormFilling
  /** Only for 2026 and later. */
  renure?: NormFilling
}

/** The input for {@link calculateFertilizerApplicationFillingsWithRegion}, per year. */
export type FertilizerApplicationFillingInputByYear = {
  "2025": NL2025NormsFillingInput
  "2026": NL2026NormsFillingInput
}

/**
 * Calculates the fillings of all legal application norms (gebruiksnormen) of a field for the
 * given year, without the calculation cache and without looking up the soil region.
 *
 * The result equals that of the functions from
 * `createUncachedFunctionsForFertilizerApplicationFilling`, but the soil region of the field is
 * passed in instead of being read from a raster. Because of that, this function is pure and
 * synchronous and can also run in the browser through `@nmi-agro/fdm-calculator/browser`, for
 * example to preview the effect of a fertilizer application that has not been saved yet.
 *
 * @param year - The year of the norms.
 * @param input - The filling input of the field, as collected by `collectInputForFertilizerApplicationFilling`.
 * @param b_region - The soil region of the field, as returned by `getRegion`.
 * @returns The filling per norm. `renure` is only present for 2026.
 * @throws When the input is not valid for the norms, for example an application with a fertilizer
 *   that is not in `input.fertilizers` or a manure without RVO code.
 */
export function calculateFertilizerApplicationFillingsWithRegion<Y extends "2025" | "2026">(
  year: Y,
  input: FertilizerApplicationFillingInputByYear[Y],
  b_region: RegionKey,
): FertilizerApplicationFillings {
  if (year === "2026") {
    const input2026 = input as NL2026NormsFillingInput
    return {
      nitrogen: calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNormWithRegion(
        input2026,
        b_region,
      ),
      manure: calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm(input2026),
      phosphate: calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm(input2026),
      renure: calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm(input2026),
    }
  }
  if (year === "2025") {
    const input2025 = input as NL2025NormsFillingInput
    return {
      nitrogen: calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNormWithRegion(
        input2025,
        b_region,
      ),
      manure: calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm(input2025),
      phosphate: calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm(input2025),
    }
  }
  throw new Error("Year not supported")
}
