/**
 * Types for the capture definitions of the manual screenshots
 * (`app/content/manual/screenshots/capture.ts`).
 *
 * A definition is plain data, so the app does not depend on Playwright. The screenshot run in
 * `fdm-app/screenshots/` turns it into browser actions.
 */

/**
 * An element on the page.
 *
 * - `role` and `name`: an element by its accessible role and name, such as
 *   `{ role: "tab", name: "Stikstof" }`. Prefer this form.
 * - `text`: the first element that contains this text.
 * - `label`: a form field by its label.
 * - `placeholder`: a form field by its placeholder.
 * - `testId`: an element with this `data-testid`.
 * - `selector`: a CSS selector, as a last resort.
 *
 * Add `exact: true` to match the name or text exactly instead of as a substring.
 */
export type CaptureTarget = (
  | { role: CaptureRole; name: string }
  | { text: string }
  | { label: string }
  | { placeholder: string }
  | { testId: string }
  | { selector: string }
) & { exact?: boolean }

/** The ARIA roles that capture definitions use. Extend the list when you need another one. */
export type CaptureRole =
  | "button"
  | "cell"
  | "checkbox"
  | "columnheader"
  | "combobox"
  | "dialog"
  | "heading"
  | "link"
  | "main"
  | "menuitem"
  | "option"
  | "region"
  | "row"
  | "tab"
  | "table"
  | "tabpanel"
  | "textbox"

/**
 * One action before the screenshot is taken.
 *
 * - `click`, `hover`: act on an element.
 * - `fill`: replace the text of a form field; `{year}` in `value` becomes the current year.
 * - `type`: type text with the keyboard, for example into a search field that just opened.
 * - `upload`: put the files of the definition's `mock` into a file input.
 * - `press`: press a key, such as `"Tab"` or `"Escape"`.
 * - `waitFor`, `waitForHidden`: wait until an element appears or disappears.
 */
export type CaptureStep =
  | { click: CaptureTarget }
  | { hover: CaptureTarget }
  | { fill: CaptureTarget; value: string }
  | { type: string }
  | { upload: CaptureTarget }
  | { press: string }
  | { waitFor: CaptureTarget }
  | { waitForHidden: CaptureTarget }

/**
 * How to capture one manual screenshot.
 *
 * Placeholders in `route`:
 *
 * - `{farm}`: the id of the demo farm;
 * - `{field:<key>}`: the id of a demo field, such as `{field:mais}` (keys in
 *   `fdm-app/e2e/seed/demo-farm.ts`);
 * - `{year}`: the current year, which is also the year of the demo data.
 */
export interface CaptureDefinition {
  /** The path to open, such as `/farm/{farm}/{year}/balance/nitrogen`. */
  route: string
  /**
   * An element that must be visible before the screenshot is taken. Choose one that only appears
   * when the page loaded correctly, so that an error or empty state fails the run instead of
   * ending up in the manual.
   */
  ready: CaptureTarget
  /** Actions after `ready`, such as opening a tab or expanding a row. */
  steps?: CaptureStep[]
  /** Capture only this element instead of the whole viewport. */
  element?: CaptureTarget
  /** Viewport size in CSS pixels. Default: 1920 × 1080, a common desktop screen. */
  viewport?: { width: number; height: number }
  /** Wait until every map on the page has finished loading (`data-map-idle="true"`). */
  map?: boolean
  /** Capture the whole scrollable page instead of the viewport. */
  fullPage?: boolean
  /** Capture the page as a visitor who is not signed in, such as the sign-in page. */
  signedOut?: boolean
  /**
   * Answer a reading service with made-up results, so the screenshot never shows a real file:
   *
   * - `soil-reader`: lab reports for the bulk upload of soil analyses (`fdm-app/e2e/screenshots/mocks.ts`).
   */
  mock?: "soil-reader"
}
