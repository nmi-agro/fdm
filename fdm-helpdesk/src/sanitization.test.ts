import { describe, expect, test } from "vitest"
import { escapeHTML } from "./sanitization"

describe("escapeHTML", () => {
    test("should leave a plain string unchanged", () => {
        expect(escapeHTML("hello world")).toBe("hello world")
    })

    test("should return an empty string unchanged", () => {
        expect(escapeHTML("")).toBe("")
    })

    test("should escape ampersands", () => {
        expect(escapeHTML("a & b")).toBe("a &amp; b")
    })

    test("should escape less-than signs", () => {
        expect(escapeHTML("<script>")).toBe("&lt;script&gt;")
    })

    test("should escape greater-than signs", () => {
        expect(escapeHTML("1 > 0")).toBe("1 &gt; 0")
    })

    test("should escape double quotes", () => {
        expect(escapeHTML('say "hello"')).toBe("say &quot;hello&quot;")
    })

    test("should escape single quotes", () => {
        expect(escapeHTML("it's")).toBe("it&#39;s")
    })

    test("should escape all special characters in a mixed string", () => {
        expect(escapeHTML(`<a href="page" class='x'>a & b</a>`)).toBe(
            "&lt;a href=&quot;page&quot; class=&#39;x&#39;&gt;a &amp; b&lt;/a&gt;",
        )
    })
})
