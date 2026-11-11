import { describe, expect, it } from "vitest"
import {
  getMcpClientGuides,
  getMcpEndpoint,
  getMcpServerName,
  MCP_KEY_PLACEHOLDER,
} from "./mcp-clients"

describe("getMcpEndpoint", () => {
  it("appends /mcp to the origin, with or without a trailing slash", () => {
    expect(getMcpEndpoint("https://mcp.example.org")).toBe("https://mcp.example.org/mcp")
    expect(getMcpEndpoint("https://mcp.example.org/")).toBe("https://mcp.example.org/mcp")
  })

  it("returns undefined when no MCP server is configured", () => {
    expect(getMcpEndpoint(undefined)).toBeUndefined()
    expect(getMcpEndpoint("")).toBeUndefined()
    expect(getMcpEndpoint("undefined")).toBeUndefined()
  })
})

describe("getMcpServerName", () => {
  it("makes a name without spaces for command-line tools", () => {
    expect(getMcpServerName("MINAS2")).toBe("minas2")
    expect(getMcpServerName(" My  App! ")).toBe("my-app")
    expect(getMcpServerName("  ")).toBe("fdm")
  })
})

describe("getMcpClientGuides", () => {
  const endpoint = "https://mcp.example.org/mcp"
  const guides = getMcpClientGuides({ appName: "My App", endpoint })

  it("has a fixed tab order", () => {
    expect(guides.map((guide) => guide.id)).toEqual([
      "claude",
      "openai",
      "lm-studio",
      "open-webui",
      "other",
    ])
  })

  it("uses the real address in every tab that connects", () => {
    for (const guide of guides) {
      const text = JSON.stringify(guide)
      expect(text, guide.id).toContain(endpoint)
    }
  })

  it("never contains a key, only the placeholder", () => {
    const snippets = guides.flatMap((guide) =>
      guide.sections.flatMap((section) => (section.code ? [section.code.text] : [])),
    )
    expect(snippets.length).toBeGreaterThan(0)
    for (const snippet of snippets) {
      expect(
        snippet.includes(MCP_KEY_PLACEHOLDER) || snippet.includes("FDM_API_KEY"),
        snippet,
      ).toBe(true)
    }
  })

  it("uses a connection name without spaces in commands and configuration", () => {
    const text = JSON.stringify(guides)
    expect(text).toContain("claude mcp add --transport http my-app ")
    expect(text).toContain("codex mcp add my-app ")
    expect(text).not.toContain("add --transport http My App")
  })

  it("produces valid JSON snippets", () => {
    for (const guide of guides) {
      for (const section of guide.sections) {
        if (section.code?.language === "json") {
          expect(() => JSON.parse(section.code?.text ?? ""), section.title).not.toThrow()
        }
      }
    }
  })
})
