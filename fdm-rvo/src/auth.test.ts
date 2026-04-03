import { RvoClient } from "@nmi-agro/rvo-connector"
import { describe, expect, it, vi } from "vitest"
import { createRvoClient, exchangeToken, generateAuthUrl } from "./auth"

// Mock the external library
vi.mock("@nmi-agro/rvo-connector", () => {
    const RvoClient = vi.fn()
    RvoClient.prototype.getAuthorizationUrl = vi
        .fn()
        .mockReturnValue("https://example.com/auth")
    RvoClient.prototype.exchangeAuthCode = vi
        .fn()
        .mockResolvedValue({ accessToken: "fake-token" })
    return { RvoClient }
})

describe("auth", () => {
    it("createRvoClient should instantiate RvoClient", () => {
        const client = createRvoClient("id", "name", "uri", "key")
        expect(RvoClient).toHaveBeenCalled()
        expect(client).toBeDefined()
    })

    it("generateAuthUrl should call getAuthorizationUrl", () => {
        const mockClient = new RvoClient({} as any)
        const url = generateAuthUrl(mockClient, "state123")
        expect(mockClient.getAuthorizationUrl).toHaveBeenCalledWith({
            state: "state123",
            services: [
                "opvragenBedrijfspercelen",
                "opvragenRegelingspercelenMest",
            ],
        })
        expect(url).toBe("https://example.com/auth")
    })

    it("exchangeToken should return access token", async () => {
        const mockClient = new RvoClient({} as any)
        const token = await exchangeToken(mockClient, "code123")
        expect(mockClient.exchangeAuthCode).toHaveBeenCalledWith("code123")
        expect(token).toBe("fake-token")
    })
})
