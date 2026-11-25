import type { ShouldRevalidateFunctionArgs } from "react-router"
import { describe, expect, it } from "vitest"
import { revalidateOnFarmOrCalendarChange } from "./revalidation"

function args(
  current: string,
  next: string,
  overrides: Partial<ShouldRevalidateFunctionArgs> = {},
): ShouldRevalidateFunctionArgs {
  const paramsOf = (path: string) => {
    const [, , b_id_farm, calendar, , b_id] = path.split("/")
    return { b_id_farm, calendar, b_id }
  }
  return {
    currentUrl: new URL(current, "http://localhost"),
    nextUrl: new URL(next, "http://localhost"),
    currentParams: paramsOf(current),
    nextParams: paramsOf(next),
    defaultShouldRevalidate: true,
    ...overrides,
  } as ShouldRevalidateFunctionArgs
}

describe("revalidateOnFarmOrCalendarChange", () => {
  it("keeps the layout data when only the field changes", () => {
    expect(
      revalidateOnFarmOrCalendarChange(args("/farm/f1/2026/field/a", "/farm/f1/2026/field/b")),
    ).toBe(false)
  })

  it("reloads when the farm or the calendar year changes", () => {
    expect(
      revalidateOnFarmOrCalendarChange(args("/farm/f1/2026/field/a", "/farm/f2/2026/field/a")),
    ).toBe(true)
    expect(
      revalidateOnFarmOrCalendarChange(args("/farm/f1/2026/field/a", "/farm/f1/2025/field/a")),
    ).toBe(true)
  })

  it("reloads after a submission", () => {
    expect(
      revalidateOnFarmOrCalendarChange(
        args("/farm/f1/2026/field/a", "/farm/f1/2026/field/b", { formMethod: "POST" }),
      ),
    ).toBe(true)
  })

  it("reloads on an explicit revalidation of the same URL", () => {
    expect(
      revalidateOnFarmOrCalendarChange(args("/farm/f1/2026/field/a", "/farm/f1/2026/field/a")),
    ).toBe(true)
  })

  it("never reloads when React Router would not", () => {
    expect(
      revalidateOnFarmOrCalendarChange(
        args("/farm/f1/2026/field/a", "/farm/f2/2026/field/a", {
          defaultShouldRevalidate: false,
        }),
      ),
    ).toBe(false)
  })
})
