// Re-export types from fdm-calculator for use within fdm-agent.
// The wildcard declaration is replaced with explicit type re-exports to enable
// type checking on tool implementations that call fdm-calculator functions.
export type {
    NutrientAdvice,
    NutrientAdviceInputs,
    NutrientAdviceResponse,
    NL2025NormsInput,
    GebruiksnormResult,
    NormFilling,
    NitrogenBalanceFieldInput,
    NitrogenBalanceFieldNumeric,
    NitrogenBalanceFieldResultNumeric,
    NitrogenBalanceInput,
    OrganicMatterBalanceFieldNumeric,
    OrganicMatterBalanceFieldResultNumeric,
    OrganicMatterBalanceInput,
} from '@nmi-agro/fdm-calculator';
