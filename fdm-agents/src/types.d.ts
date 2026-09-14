import type { ZodV4ObjectLike } from "@langchain/core/utils/types"
import type { AgentTypeConfig, ReactAgent } from "langchain"

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

export type BaseContextSchema = ZodV4ObjectLike

/**
 * Minimal interface for an agent that can be streamed through runOneShotAgent and runStreamAgent.
 * Using an explicit structural type prevents leaking internal fdm-calculator
 * types (e.g. DierlijkeMestGebruiksnormResult) into the package's declaration files.
 */
export type FdmAgent<T_ContextSchema extends BaseContextSchema = BaseContextSchema> = Pick<
  ReactAgent<AgentTypeConfig<Record<string, any>, undefined, T_ContextSchema>>,
  "stream" | "streamEvents"
>
