/** The four event types the timeline's quick-add flow can create. */
export type AddEventType = "fertilizer" | "harvest" | "soil" | "cultivation-start"

/**
 * Context gathered from where the user triggered the quick-add flow (an empty-space click, a
 * cultivation bar's right-click menu, or — partially — the toolbar button). `b_lu` is only known
 * when the trigger was on/near a specific cultivation (a right-click, or an empty-space click
 * that resolved to a cultivation covering that date).
 */
export type AddEventContext = {
  b_id: string
  date: Date
  b_lu?: string
}

/** What the Sheet needs to render the right form and target the right existing route action. */
export type AddEventSheetRequest =
  | { type: "fertilizer"; context: AddEventContext }
  | { type: "harvest"; context: AddEventContext }
  | { type: "cultivation-start"; context: AddEventContext }
  | { type: "cultivation-end"; context: AddEventContext }
