export type NutrientDescription = {
  name: string
  symbol: string
  type: "primary" | "secondary" | "trace"
  unit: string
  adviceParameter: string
  doseParameter: string
}
