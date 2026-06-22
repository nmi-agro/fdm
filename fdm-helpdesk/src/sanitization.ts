/**
 * Escapes the given HTML, eliminating most XSS vulnerabilities.
 *
 * @param html Input to escape
 * @returns the escaped HTML
 */
export function escapeHTML(html: string) {
    // Escape every HTML-special character so all tags render as plain text.
    return html
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll(`"`, "&quot;")
        .replaceAll("'", "&#39;")
}
