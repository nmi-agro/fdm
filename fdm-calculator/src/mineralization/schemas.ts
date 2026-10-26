/**
 * @packageDocumentation
 * @module mineralization/schemas
 *
 * Zod validation schemas for the Dyna v2 response of the NMI API.
 */

import { z } from "zod"

// ─── Dyna v2 schemas ──────────────────────────────────────────────────────────

/** Message used when Dyna returns no simulation days. */
export const DYNA_V2_EMPTY_SERIES_MESSAGE = "Geen resultaten van Dyna ontvangen"

const balanceValue = z.number().catch(0).default(0)

/**
 * Validates the `data` object returned by `POST /bemestingsplan/dyna/v2`.
 *
 * Adds the derived available nitrogen (`b_nw − b_n_uptake`) to every day, sorts the days by date
 * and fills balance components that are not reported with 0.
 */
export const dynaV2ResponseDataSchema = z
  .object({
    calculation_dyna: z
      .array(
        z.object({
          b_date_calculation: z.string(),
          b_nw: z.number(),
          b_n_uptake: z.number(),
          b_no3_leach: z.number(),
        }),
      )
      .min(1, DYNA_V2_EMPTY_SERIES_MESSAGE),
    nitrogen_balance: z
      .object({
        b_nw: balanceValue,
        b_n_uptake: balanceValue,
        b_n_fertilizer_mineral: balanceValue,
        b_n_fertilizer_organic: balanceValue,
        b_n_fertilizer_preceeding: balanceValue,
        b_n_greenmanure: balanceValue,
      })
      .nullish(),
  })
  .transform((data) => ({
    series: data.calculation_dyna
      .map((day) => ({
        b_date_calculation: day.b_date_calculation,
        b_nw: day.b_nw,
        b_n_uptake: day.b_n_uptake,
        b_no3_leach: day.b_no3_leach,
        b_n_available: day.b_nw - day.b_n_uptake,
      }))
      .sort((a, b) => a.b_date_calculation.localeCompare(b.b_date_calculation)),
    balance: {
      b_nw: data.nitrogen_balance?.b_nw ?? 0,
      b_n_uptake: data.nitrogen_balance?.b_n_uptake ?? 0,
      b_n_fertilizer_mineral: data.nitrogen_balance?.b_n_fertilizer_mineral ?? 0,
      b_n_fertilizer_organic: data.nitrogen_balance?.b_n_fertilizer_organic ?? 0,
      b_n_fertilizer_preceeding: data.nitrogen_balance?.b_n_fertilizer_preceeding ?? 0,
      b_n_greenmanure: data.nitrogen_balance?.b_n_greenmanure ?? 0,
    },
  }))
