/**
 * Deterministically derives a stable color for an agent, based solely on their `agent_id`.
 *
 * The same agent always gets the same color, regardless of which month/year is being viewed,
 * since the color is a pure function of the id rather than of render order or fetched data.
 */
export function getAgentColor(
  agent_id: string,
  isPrimary: boolean,
): {
  background: string
  border: string
  text: string
} {
  const hue = hashToHue(agent_id)

  if (isPrimary) {
    return {
      background: `hsl(${hue}, 80%, 60%)`,
      border: `hsl(${hue}, 80%, 60%)`,
      text:
        (hue > 15 && hue < 60) || (hue > 120 && hue < 195) || (hue > 285 && hue < 330)
          ? "black"
          : "white",
    }
  }

  return {
    background: `hsl(${hue}, 70%, 92%)`,
    border: `hsl(${hue}, 55%, 55%)`,
    text: `hsl(${hue}, 55%, 25%)`,
  }
}

/** Hashes a string to a value in [0, 360), suitable for use as an HSL hue. */
function hashToHue(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0 // Convert to 32-bit integer
  }
  return Math.abs(hash) % 360
}
