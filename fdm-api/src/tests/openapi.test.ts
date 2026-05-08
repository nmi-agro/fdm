import { describe, it, expect, vi } from "vitest"
import { validate } from "@scalar/openapi-parser"
import { createFdmApi } from "../index"

const mockAuth = {
    api: {
        verifyApiKey: vi.fn().mockResolvedValue({
            valid: false,
            error: { message: "Invalid API key" },
            key: null,
        }),
    },
} as any

const mockFdm = {} as any

const config = { appName: "Test App", appUrl: "https://test.example.com" }

describe("OpenAPI spec", () => {
    it("serves a valid OpenAPI 3.1 document at /openapi.json", async () => {
        const app = createFdmApi(mockFdm, mockAuth, config)

        const res = await app.request("/openapi.json")
        expect(res.status).toBe(200)

        const spec = await res.text()
        const { valid, errors } = await validate(spec)
        expect(errors ?? []).toEqual([])
        expect(valid).toBe(true)
    })
})
