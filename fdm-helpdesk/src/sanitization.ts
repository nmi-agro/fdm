/**
 * Escapes the given HTML, eliminating most XSS vulnerabilities.
 *
 * @param html Input to escape
 * @returns the escaped HTML
 */
export function escapeHTML(html: string) {
    // Escape every HTML-special character so all tags render as plain text.
    return html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;")
}
