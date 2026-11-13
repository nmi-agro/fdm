import {
  calculateFarmGroupNitrogenBalance,
  calculateFarmGroupOrganicMatterBalance,
  calculateFarmNitrogenBalance,
  calculateFarmOrganicMatterBalance,
  calculateFieldNitrogenBalance,
  calculateFieldOrganicMatterBalance,
  calculateOrganizationNitrogenBalance,
  calculateOrganizationOrganicMatterBalance,
  getFarmFertilizationNorms,
  getFarmGroupIndicators,
  getFarmIndicators,
  getFarmNutrientAdvice,
  getFieldDose,
  getFieldFertilizationNorms,
  getFieldIndicators,
  getFieldNutrientAdvice,
  getOrganizationIndicators,
} from "@nmi-agro/fdm-api/operations"
import { type McpTool, operationTool, scopedTool } from "./types"

/**
 * Scopes of the aggregating calculations. Groups and organizations come first: they accept an
 * optional `b_id_farm` filter, which would otherwise select the farm scope.
 */
const SCOPE_ORDER =
  "Give exactly one of `organization_id` (an organization), `b_id_group` (a farm group), `b_id_farm` (a farm) or `b_id` (a field)."

/** Tools for calculations: nutrient balances, fertilization norms, doses, advice and indicators. */
export const calculationTools: McpTool[] = [
  scopedTool(
    {
      name: "calculate_nitrogen_balance",
      title: "Calculate the nitrogen balance",
      description: `Calculates the nitrogen balance in kg N/ha: supply (fertilizers, fixation, deposition, mineralization), removal (harvests, crop residues) and emission (ammonia, nitrate). ${SCOPE_ORDER} For a field or farm give the period with \`start\` and \`end\` (YYYY-MM-DD); for a group or organization give the \`year\` (optionally only some farms with \`b_id_farm\`).`,
    },
    [
      {
        scope: "organization",
        operation: calculateOrganizationNitrogenBalance,
        key: "organization_id",
      },
      { scope: "farm_group", operation: calculateFarmGroupNitrogenBalance, key: "b_id_group" },
      { scope: "farm", operation: calculateFarmNitrogenBalance, key: "b_id_farm" },
      { scope: "field", operation: calculateFieldNitrogenBalance, key: "b_id" },
    ],
  ),
  scopedTool(
    {
      name: "calculate_organic_matter_balance",
      title: "Calculate the organic matter balance",
      description: `Calculates the effective organic matter balance in kg EOM/ha/year: supply from fertilizers, crop residues and cover crops, and degradation. ${SCOPE_ORDER} For a field or farm give the period with \`start\` and \`end\` (YYYY-MM-DD); for a group or organization give the \`year\` (optionally only some farms with \`b_id_farm\`).`,
    },
    [
      {
        scope: "organization",
        operation: calculateOrganizationOrganicMatterBalance,
        key: "organization_id",
      },
      { scope: "farm_group", operation: calculateFarmGroupOrganicMatterBalance, key: "b_id_group" },
      { scope: "farm", operation: calculateFarmOrganicMatterBalance, key: "b_id_farm" },
      { scope: "field", operation: calculateFieldOrganicMatterBalance, key: "b_id" },
    ],
  ),
  scopedTool(
    {
      name: "get_fertilization_norms",
      title: "Get the fertilization norms",
      description:
        "Returns the legal fertilization norms (gebruiksnormen) for a `year`: nitrogen, nitrogen from animal manure and phosphate, in kg/ha per field and in kg for the farm. Give `b_id_farm` for a farm or `b_id` for one field.",
    },
    [
      { scope: "farm", operation: getFarmFertilizationNorms, key: "b_id_farm" },
      { scope: "field", operation: getFieldFertilizationNorms, key: "b_id" },
    ],
  ),
  operationTool(getFieldDose, {
    name: "get_dose_for_field",
    title: "Get the applied dose of a field",
    description:
      "Returns the total nutrients applied on a field (`b_id`) by its fertilizer applications, in kg/ha: nitrogen (total and from manure), phosphate, potassium and other nutrients.",
  }),
  scopedTool(
    {
      name: "get_nutrient_advice",
      title: "Get the nutrient advice",
      description:
        "Returns the nutrient advice for a `year`, per field and nutrient, in the units of the result descriptions. Give `b_id_farm` for every field of a farm or `b_id` for one field. Uses the NMI API. Present it as advice for the user to check.",
    },
    [
      { scope: "farm", operation: getFarmNutrientAdvice, key: "b_id_farm" },
      { scope: "field", operation: getFieldNutrientAdvice, key: "b_id" },
    ],
  ),
  scopedTool(
    {
      name: "get_indicators",
      title: "Get the soil quality indicators",
      description: `Returns the soil quality indicators (scores from 0 to 1, for example for nutrient supply, soil structure and water) for a \`year\`. ${SCOPE_ORDER} For a group or organization, optionally only some farms with \`b_id_farm\`. Uses the NMI API.`,
    },
    [
      { scope: "organization", operation: getOrganizationIndicators, key: "organization_id" },
      { scope: "farm_group", operation: getFarmGroupIndicators, key: "b_id_group" },
      { scope: "farm", operation: getFarmIndicators, key: "b_id_farm" },
      { scope: "field", operation: getFieldIndicators, key: "b_id" },
    ],
  ),
]
