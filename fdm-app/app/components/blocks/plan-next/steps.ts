import type { SeasonPlanStep } from "@nmi-agro/fdm-core"

/** A step of the season planning wizard, as shown in the app. */
export type PlanNextStep = {
  key: SeasonPlanStep
  /** URL segment of the step. */
  slug: string
  title: string
  description: string
}

/** The steps of the season planning wizard, in order. Keep in sync with `SEASON_PLAN_STEPS`. */
export const PLAN_NEXT_STEPS: PlanNextStep[] = [
  {
    key: "start",
    slug: "start",
    title: "Start",
    description: "Kies het jaar en bekijk per perceel waar het voorstel op is gebaseerd.",
  },
  {
    key: "fields",
    slug: "fields",
    title: "Percelen",
    description: "Behoud percelen, geef aan welke niet meer beschikbaar zijn en voeg nieuwe toe.",
  },
  {
    key: "cultivations",
    slug: "cultivations",
    title: "Gewassen",
    description: "Leg per perceel de hoofdteelt vast.",
  },
  {
    key: "catch_crops",
    slug: "catch-crops",
    title: "Vanggewas/groenbemester",
    description: "Leg vanggewassen en groenbemesters na de hoofdteelt vast.",
  },
  {
    key: "measures",
    slug: "measures",
    title: "Maatregelen",
    description: "Bekijk welke maatregelen doorlopen, aflopen of zijn beëindigd.",
  },
  {
    key: "fertilizers",
    slug: "fertilizers",
    title: "Bemesting",
    description: "Leg per perceel de bemesting vast.",
  },
  {
    key: "harvests",
    slug: "harvests",
    title: "Oogst & overzicht",
    description: "Leg de verwachte opbrengsten vast en bekijk het plan.",
  },
]

/** Returns the step with a URL segment, or `undefined`. */
export function getPlanNextStepBySlug(slug: string | undefined): PlanNextStep | undefined {
  return PLAN_NEXT_STEPS.find((step) => step.slug === slug)
}

/** Returns the step with a key. */
export function getPlanNextStep(key: SeasonPlanStep): PlanNextStep {
  return PLAN_NEXT_STEPS.find((step) => step.key === key) ?? PLAN_NEXT_STEPS[0]
}

/** Returns the path of the wizard of a farm, or of a step in a year. */
export function getPlanNextPath(b_id_farm: string, year?: number | string, key?: SeasonPlanStep) {
  const base = `/farm/${b_id_farm}/plan-next`
  if (year === undefined) return base
  return key ? `${base}/${year}/${getPlanNextStep(key).slug}` : `${base}/${year}`
}

/** Returns the step before and after a step, or `undefined` at the start or end. */
export function getAdjacentPlanNextSteps(key: SeasonPlanStep): {
  previous: PlanNextStep | undefined
  next: PlanNextStep | undefined
} {
  const index = PLAN_NEXT_STEPS.findIndex((step) => step.key === key)
  return {
    previous: index > 0 ? PLAN_NEXT_STEPS[index - 1] : undefined,
    next: index >= 0 && index < PLAN_NEXT_STEPS.length - 1 ? PLAN_NEXT_STEPS[index + 1] : undefined,
  }
}
