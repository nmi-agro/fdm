/**
 * Server-only BCS calculation utilities.
 *
 * @nmi-agro/fdm-calculator cannot be imported in client code because its barrel
 * export transitively pulls in fdm-core which uses node:async_hooks.
 * This .server.ts file ensures Vite never includes it in client bundles.
 */
import {
    type BcsLabContext,
    calculateBcs,
    getBcsScoreColor,
    getBcsScoreLabel,
} from "@nmi-agro/fdm-calculator"
import type { BcsScores } from "~/components/blocks/soil-visual/bcs-color-utils"

export type { BcsColor } from "~/components/blocks/soil-visual/bcs-color-utils"
export type { BcsLabContext }

/** Compute BCS scores server-side and return all display-ready values */
export function computeBcs(scores: BcsScores, labContext?: BcsLabContext) {
    const { d_bcs, i_bcs, a_ph_bcs, a_som_bcs } = calculateBcs(
        scores,
        labContext,
    )
    const scoreColor = getBcsScoreColor(d_bcs)
    const scoreLabel = getBcsScoreLabel(d_bcs)
    return { d_bcs, i_bcs, a_ph_bcs, a_som_bcs, scoreColor, scoreLabel }
}
