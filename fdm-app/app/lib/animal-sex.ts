/**
 * The Dutch word for the sex of an animal, as it reads in a sentence ("Het geslacht wordt
 * vrouwelijk").
 *
 * @param l_sex - The sex.
 * @returns "vrouwelijk", "mannelijk", or the value itself for an unknown value.
 */
export function sexLabel(l_sex: string): string {
  if (l_sex === "female") return "vrouwelijk"
  if (l_sex === "male") return "mannelijk"
  return l_sex
}
