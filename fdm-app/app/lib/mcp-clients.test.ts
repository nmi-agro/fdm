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

  it("returns undefined for a value that is not an http or https address", () => {
    expect(getMcpEndpoint("not-a-url")).toBeUndefined()
    expect(getMcpEndpoint("ftp://mcp.example.org")).toBeUndefined()
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
  const allSections = [guides.primary, ...guides.developer.flatMap((guide) => guide.sections)]

  it("leads with claude.ai and keeps the developer tabs in a fixed order", () => {
    expect(guides.primary.title).toContain("claude.ai")
    expect(guides.developer.map((guide) => guide.id)).toEqual([
      "cli",
      "openai-api",
      "local",
      "other",
    ])
  })

  it("keeps the developer choice within four tabs", () => {
    expect(guides.developer.length).toBeLessThanOrEqual(4)
  })

  it("names the assistants that cannot connect yet", () => {
    expect(guides.unsupported.map((client) => client.label)).toContain("ChatGPT op het web")
  })

  it("uses the real address in the main guide and in every developer tab", () => {
    expect(JSON.stringify(guides.primary)).toContain(endpoint)
    for (const guide of guides.developer) {
      expect(JSON.stringify(guide), guide.id).toContain(endpoint)
    }
  })

  it("never contains a key, only the placeholder", () => {
    const snippets = allSections.flatMap((section) => (section.code ? [section.code.text] : []))
    expect(snippets.length).toBeGreaterThan(0)
    for (const snippet of snippets) {
      expect(
        snippet.includes(MCP_KEY_PLACEHOLDER) || snippet.includes("FDM_API_KEY"),
        snippet,
      ).toBe(true)
    }
  })

  it("keeps the key out of terminal commands, which end up in the shell history", () => {
    const commands = allSections.flatMap((section) =>
      section.code?.language === "bash" ? [section.code.text] : [],
    )
    expect(commands.length).toBeGreaterThan(0)
    for (const command of commands) {
      expect(command, command).not.toContain(MCP_KEY_PLACEHOLDER)
      expect(command, command).toContain("FDM_API_KEY")
    }
    // Single quotes, so the shell does not replace the variable with the key.
    expect(JSON.stringify(guides)).toContain("--header 'X-API-Key: ${FDM_API_KEY}'")
  })

  it("lets mcp-remote read the key from its environment instead of its arguments", () => {
    const other = guides.developer.find((guide) => guide.id === "other")
    const config = JSON.parse(other?.sections[0]?.code?.text ?? "{}")
    const server = config.mcpServers["my-app"]
    expect(server.args).toContain("X-API-Key:${FDM_API_KEY}")
    expect(server.env).toEqual({ FDM_API_KEY: MCP_KEY_PLACEHOLDER })
  })

  it("offers a setup request for Claude Code and Codex that never asks for the key", () => {
    const cli = guides.developer.find((guide) => guide.id === "cli")
    const prompt = cli?.sections.find((section) => section.code?.language === "text")?.code?.text
    expect(prompt).toBeDefined()
    expect(prompt).toContain(endpoint)
    expect(prompt).toContain("claude mcp add --transport http my-app ")
    expect(prompt).toContain("codex mcp add my-app ")
    expect(prompt).toContain("FDM_API_KEY")
    expect(prompt).not.toContain(MCP_KEY_PLACEHOLDER)
  })

  it("uses a connection name without spaces in commands and configuration", () => {
    const text = JSON.stringify(guides)
    expect(text).toContain("claude mcp add --transport http my-app ")
    expect(text).toContain("codex mcp add my-app ")
    expect(text).not.toContain("add --transport http My App")
  })

  it("produces valid JSON snippets", () => {
    for (const section of allSections) {
      if (section.code?.language === "json") {
        expect(() => JSON.parse(section.code?.text ?? ""), section.title).not.toThrow()
      }
    }
  })
})
