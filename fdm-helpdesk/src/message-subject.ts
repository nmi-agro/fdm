/**
 * Generate a short subject line from the user's message body.
 * Uses a simple extraction approach (first sentence, capped at 80 chars).
 * Used as a fast fallback when Gemini is unavailable.
 */
export function summarizeForSubject(messageBody: string): string {
    const plain = messageBody.replace(/<[^>]*>/g, "").trim()
    const firstSentence = plain.split(/[.\n]/)[0]?.trim() || plain
    if (firstSentence.length <= 80) return firstSentence
    return `${firstSentence.substring(0, 77)}...`
}
