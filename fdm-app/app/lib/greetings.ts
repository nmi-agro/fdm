export function getTimeBasedGreeting(date = new Date()): string {
  const hours = date.getHours()
  if (hours < 5) return "Goedenacht"
  if (hours < 12) return "Goedemorgen"
  if (hours < 18) return "Goedemiddag"
  return "Goedenavond"
}
