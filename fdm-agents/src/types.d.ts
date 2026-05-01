// Re-export types from fdm-calculator for use within fdm-agents.
// The wildcard declaration is replaced with explicit type re-exports to enable
// type checking on tool implementations that call fdm-calculator functions.
export type {
    GebruiksnormResult,
    NitrogenBalanceFieldInput,
    NitrogenBalanceFieldNumeric,
    NitrogenBalanceFieldResultNumeric,
    NitrogenBalanceInput,
    NL2025NormsInput,
    NormFilling,
    NutrientAdvice,
    NutrientAdviceInputs,
    NutrientAdviceResponse,
    OrganicMatterBalanceFieldNumeric,
    OrganicMatterBalanceFieldResultNumeric,
    OrganicMatterBalanceInput,
} from "@nmi-agro/fdm-calculator"
