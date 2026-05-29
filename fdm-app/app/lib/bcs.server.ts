/**
 * Server-only BCS calculation utilities.
 * 
 * @nmi-agro/fdm-calculator cannot be imported in client code because its barrel
 * export transitively pulls in fdm-core which uses node:async_hooks.
 * This .server.ts file ensures Vite never includes it in client bundles.
 */
import { calculateBcs, getBcsScoreColor, getBcsScoreLabel } from "@nmi-agro/fdm-calculator"
import type { BcsScores } from "~/components/blocks/soil-visual/bcs-color-utils"

export type { BcsColor } from "~/components/blocks/soil-visual/bcs-color-utils"

/** Compute BCS scores server-side and return all display-ready values */
export function computeBcs(scores: BcsScores) {
    const { d_bcs, i_bcs } = calculateBcs(scores)
    const scoreColor = getBcsScoreColor(d_bcs)
    const scoreLabel = getBcsScoreLabel(d_bcs)
    return { d_bcs, i_bcs, scoreColor, scoreLabel }
}
