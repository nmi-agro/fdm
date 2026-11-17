import { fdmSchema } from "@nmi-agro/fdm-core"
import { getTableColumns } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { soilParameterDescriptions } from "../fields"

/** Columns of the soil analysis table that are not soil parameters. */
const NON_PARAMETER_COLUMNS = new Set([
  "a_id",
  "a_date",
  "a_source",
  "a_file_path",
  "created",
  "updated",
])

describe("soil parameters", () => {
  it("covers every soil parameter column of fdm-core", () => {
    // When this fails, fdm-core has a new soil parameter: add it with a description to
    // `soilParameterDescriptions` in src/fields.ts, so the API accepts and returns it.
    const columns = Object.keys(getTableColumns(fdmSchema.soilAnalysis)).filter(
      (column) => !NON_PARAMETER_COLUMNS.has(column),
    )
    const documented = new Set(Object.keys(soilParameterDescriptions))
    expect(columns.filter((column) => !documented.has(column))).toEqual([])
  })
})
