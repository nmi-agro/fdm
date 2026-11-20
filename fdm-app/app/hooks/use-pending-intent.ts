import { useNavigation } from "react-router"

/**
 * Returns the `intent` of the form submission that is in progress for one item on the page, for
 * example one invitation in a list, so only that item's button shows its submitting state.
 *
 * Covers the whole submission, including the redirect or revalidation after the action.
 *
 * @param name - The name of the form field that identifies the item, such as `invitation_id`.
 * @param value - The value of that field for this item.
 * @returns The submitted `intent`, or `null` when no submission for this item is in progress.
 */
export function usePendingIntent(name: string, value: string): string | null {
  const navigation = useNavigation()
  if (navigation.state === "idle" || !navigation.formData) return null
  if (navigation.formData.get(name) !== value) return null
  const intent = navigation.formData.get("intent")
  return typeof intent === "string" ? intent : null
}
