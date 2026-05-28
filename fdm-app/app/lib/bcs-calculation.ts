/**
 * Re-exports BCS calculation utilities from @nmi-agro/fdm-calculator.
 * Import from there directly for new code.
 */
export {
    BCS_INDICATORS,
    calculateBcs,
    getBcsScoreColor,
} from "@nmi-agro/fdm-calculator"
export type {
    BcsIndicatorKey,
    BcsResult,
    BcsScores,
} from "@nmi-agro/fdm-calculator"
