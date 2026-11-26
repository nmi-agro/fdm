/**
 * The current moment for the grazing pages on the server.
 *
 * `FDM_FIXED_TODAY` (`YYYY-MM-DD`) fixes the day these pages treat as today. The manual's
 * screenshot run sets it to the day it fixes the browser clock to, so the server and the browser
 * agree on "today" (grazing status, rest days, realised and planned days). Leave it unset
 * everywhere else.
 *
 * @returns Noon of the fixed day in the Netherlands, or the real current moment.
 */
export function serverNow(): Date {
  const fixed = process.env.FDM_FIXED_TODAY
  if (fixed && /^\d{4}-\d{2}-\d{2}$/.test(fixed)) {
    // 10:00 UTC is noon in summer and 11:00 in winter in the Netherlands: the same calendar day
    const date = new Date(`${fixed}T10:00:00.000Z`)
    if (!Number.isNaN(date.getTime())) return date
  }
  return new Date()
}
