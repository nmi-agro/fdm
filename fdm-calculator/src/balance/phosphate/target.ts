import type { PhosphateFrame } from "./types"
import { P_AL_GOOD_MAX, P_AL_GOOD_MIN } from "./projection"

/**
 * Determines the Opbouwen / Onderhouden / Afbouwen frame from P-AL: P-AL < 35 opbouwen, 35–45
 * onderhouden, > 45 afbouwen (Handboek Bodem en Bemesting, class Goed). The minimum desirable
 * balance is the fixation (offtake + fixation) when building up or maintaining; when reducing, a
 * deficit is acceptable.
 *
 * DRAFT: the same P-AL bands are used for grassland and arable land.
 *
 * @param a_p_al - P-AL (mg P2O5 / 100 g), or `null`.
 * @param fixation - Fixation (kg P2O5 / ha / year).
 * @returns The frame.
 */
export function determinePhosphateFrame(a_p_al: number | null, fixation: number): PhosphateFrame {
  if (a_p_al === null) return { name: null, a_p_al: null, target_balance_min: null }
  if (a_p_al < P_AL_GOOD_MIN) return { name: "opbouwen", a_p_al, target_balance_min: fixation }
  if (a_p_al <= P_AL_GOOD_MAX) return { name: "onderhouden", a_p_al, target_balance_min: fixation }
  return { name: "afbouwen", a_p_al, target_balance_min: null }
}
