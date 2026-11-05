import type { FdmType, FertilizerPlan } from "@nmi-agro/fdm-core"
import { addFertilizerPlan, removeFertilizerPlan } from "@nmi-agro/fdm-core"
import { buildObjectKey, type FileStorage } from "@nmi-agro/fdm-storage"
import { renderToBuffer } from "@react-pdf/renderer"
import { randomUUID } from "node:crypto"
import { createElement } from "react"
import type { FertilizerPlanData, ReportBranding } from "./types"
import {
  collectFertilizerPlanInput,
  computeFertilizerPlanData,
  getFertilizerPlanInputHash,
} from "./data"
import { FertilizerPlanPdf } from "./pdf/FertilizerPlanPdf"

/**
 * Renders the PDF of a fertilizer plan.
 *
 * @param data - The plan content from `computeFertilizerPlanData`.
 * @returns The PDF file.
 */
export async function renderFertilizerPlanPdf(data: FertilizerPlanData): Promise<Buffer> {
  const document = createElement(FertilizerPlanPdf, { data }) as unknown as Parameters<
    typeof renderToBuffer
  >[0]
  return renderToBuffer(document)
}

/** Input for {@link establishFertilizerPlan}. */
export interface EstablishFertilizerPlanInput {
  /** The FDM instance. */
  fdm: FdmType
  /** The principal creating the plan. Needs write access to the farm. */
  principal_id: string
  /** The farm. */
  b_id_farm: string
  /** Calendar year of the plan. */
  year: number
  /** Storage for the PDF. */
  storage: FileStorage
  /** NMI API key used for the nutrient advice. */
  nmiApiKey: string | undefined
  /** Name and images shown in the PDF. */
  branding: ReportBranding
}

/**
 * Generates a fertilizer plan for a farm and year, stores the PDF and saves the plan.
 *
 * The PDF is uploaded before the plan is saved, so a saved plan always has a file. When saving
 * the plan fails, the uploaded file is deleted again.
 *
 * @param input - Farm, year, storage, NMI API key and branding.
 * @returns The ID of the new plan.
 * @example
 * ```ts
 * const p_id_plan = await establishFertilizerPlan({ fdm, principal_id, b_id_farm, year: 2026, storage, nmiApiKey, branding })
 * ```
 */
export async function establishFertilizerPlan(
  input: EstablishFertilizerPlanInput,
): Promise<string> {
  const { fdm, principal_id, b_id_farm, year, storage } = input

  const dataCollectionDate = new Date()
  const planInput = await collectFertilizerPlanInput(fdm, principal_id, b_id_farm, year)
  const inputHash = getFertilizerPlanInputHash(planInput)
  const data = await computeFertilizerPlanData(fdm, planInput, {
    nmiApiKey: input.nmiApiKey,
    branding: input.branding,
  })
  const pdf = await renderFertilizerPlanPdf(data)

  const objectKey = buildObjectKey("bemestingsplan", randomUUID(), "pdf")
  await storage.upload(objectKey, pdf, "application/pdf")
  try {
    return await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      year,
      objectKey,
      inputHash,
      dataCollectionDate,
    )
  } catch (error) {
    await storage.delete(objectKey).catch(() => {})
    throw error
  }
}

/**
 * Removes a fertilizer plan and its PDF. The plan is removed first; when the PDF cannot be
 * deleted afterwards, the error is returned so the caller can report the leftover file.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal removing the plan. Needs write access to the plan.
 * @param plan - The plan, from `getFertilizerPlan`.
 * @param storage - Storage that holds the PDF.
 * @returns `undefined`, or the error of deleting the PDF.
 */
export async function removeFertilizerPlanWithFile(
  fdm: FdmType,
  principal_id: string,
  plan: Pick<FertilizerPlan, "p_id_plan" | "p_plan_file_path">,
  storage: FileStorage,
): Promise<unknown> {
  await removeFertilizerPlan(fdm, principal_id, plan.p_id_plan)
  if (!plan.p_plan_file_path) return undefined
  try {
    await storage.delete(plan.p_plan_file_path)
    return undefined
  } catch (error) {
    return error
  }
}

/**
 * Whether a saved fertilizer plan still matches the current data of the farm.
 *
 * - `fresh`: the data the plan is based on has not changed.
 * - `expired`: the data has changed, or the calculation method has changed since.
 * - `unknown`: the current data could not be read.
 */
export type FertilizerPlanStatus = "fresh" | "expired" | "unknown"

/**
 * Creates a function that returns the status of saved plans of a farm. The current input of each
 * year is collected once and only when a plan of that year is checked, one year after the other
 * to limit the database load.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal reading the plans. Needs read access to the farm.
 * @param b_id_farm - The farm.
 * @returns A function that returns the status of a plan of this farm.
 */
export function createFertilizerPlanStatusChecker(
  fdm: FdmType,
  principal_id: string,
  b_id_farm: string,
): (plan: Pick<FertilizerPlan, "p_plan_year" | "p_plan_hash">) => Promise<FertilizerPlanStatus> {
  const hashes = new Map<number, Promise<string | undefined>>()
  let previous: Promise<unknown> = Promise.resolve()

  return async (plan) => {
    let hash = hashes.get(plan.p_plan_year)
    if (!hash) {
      hash = previous.then(async () => {
        try {
          const input = await collectFertilizerPlanInput(
            fdm,
            principal_id,
            b_id_farm,
            plan.p_plan_year,
          )
          return getFertilizerPlanInputHash(input)
        } catch {
          return undefined
        }
      })
      hashes.set(plan.p_plan_year, hash)
      previous = hash
    }
    const current = await hash
    if (current === undefined) return "unknown"
    return current === plan.p_plan_hash ? "fresh" : "expired"
  }
}
