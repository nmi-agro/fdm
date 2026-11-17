/**
 * Timezone the greeting is resolved in.
 *
 * The greeting is rendered on the server and reused by the browser while it hydrates, so it has
 * to be derived from a clock both sides agree on. Reading the hour from the local clock instead
 * makes the two renders disagree whenever the server and the browser sit in different timezones,
 * which React reports as a hydration mismatch. A fixed timezone also keeps the greeting correct
 * for the Dutch audience of the interface regardless of how the server is configured.
 */
const greetingTimeZone = "Europe/Amsterdam"

const greetingHourFormatter = new Intl.DateTimeFormat("nl-NL", {
  timeZone: greetingTimeZone,
  hour: "numeric",
  hourCycle: "h23",
})

/**
 * Returns the Dutch greeting that matches the time of day of the given moment.
 *
 * The time of day is determined in the timezone of the interface, not in the timezone of the
 * machine that calls this function. Call it once per page render, on the server, and pass the
 * result to the browser: calling it again while the browser hydrates can cross an hour boundary
 * and produce a different greeting than the one in the server-rendered markup.
 *
 * @param date - The moment to greet for. Defaults to the current moment.
 * @returns One of "Goedenacht", "Goedemorgen", "Goedemiddag" or "Goedenavond".
 */
export function getTimeBasedGreeting(date = new Date()): string {
  const hours = Number(greetingHourFormatter.format(date))
  if (hours < 5) return "Goedenacht"
  if (hours < 12) return "Goedemorgen"
  if (hours < 18) return "Goedemiddag"
  return "Goedenavond"
}
