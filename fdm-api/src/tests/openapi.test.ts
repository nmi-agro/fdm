import { validate } from "@scalar/openapi-parser"
import { describe, expect, it, vi } from "vitest"
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

type SchemaNode = Record<string, any>

/**
 * Collects every property in a JSON schema that has no `description`.
 *
 * `$ref` nodes are skipped: the referenced component is checked on its own.
 */
function findUndocumentedProperties(schema: SchemaNode | undefined, path: string): string[] {
  if (!schema || typeof schema !== "object" || "$ref" in schema) return []
  const missing: string[] = []
  for (const [name, property] of Object.entries<SchemaNode>(schema.properties ?? {})) {
    const propertyPath = `${path}.${name}`
    if (!("$ref" in property) && !property.description) missing.push(propertyPath)
    missing.push(...findUndocumentedProperties(property, propertyPath))
  }
  if (schema.items) missing.push(...findUndocumentedProperties(schema.items, `${path}[]`))
  for (const [index, item] of (schema.prefixItems ?? []).entries()) {
    missing.push(...findUndocumentedProperties(item, `${path}[${index}]`))
  }
  for (const keyword of ["anyOf", "oneOf", "allOf"] as const) {
    for (const [index, variant] of (schema[keyword] ?? []).entries()) {
      missing.push(...findUndocumentedProperties(variant, `${path}<${keyword}:${index}>`))
    }
  }
  if (typeof schema.additionalProperties === "object") {
    missing.push(...findUndocumentedProperties(schema.additionalProperties, `${path}{}`))
  }
  return missing
}

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

  it("describes every schema property and parameter", async () => {
    const app = createFdmApi(mockFdm, mockAuth, config)
    const spec = await (await app.request("/openapi.json")).json()

    const missing: string[] = []
    for (const [name, schema] of Object.entries<SchemaNode>(spec.components?.schemas ?? {})) {
      missing.push(...findUndocumentedProperties(schema, name))
    }
    for (const [path, operations] of Object.entries<SchemaNode>(spec.paths ?? {})) {
      for (const [method, operation] of Object.entries<SchemaNode>(operations)) {
        const location = `${method.toUpperCase()} ${path}`
        for (const parameter of operation.parameters ?? []) {
          if (!parameter.description) {
            missing.push(`${location} ${parameter.in} parameter '${parameter.name}'`)
          }
        }
        for (const [type, media] of Object.entries<SchemaNode>(
          operation.requestBody?.content ?? {},
        )) {
          missing.push(...findUndocumentedProperties(media.schema, `${location} body(${type})`))
        }
        for (const [status, response] of Object.entries<SchemaNode>(operation.responses ?? {})) {
          for (const [type, media] of Object.entries<SchemaNode>(response.content ?? {})) {
            missing.push(
              ...findUndocumentedProperties(media.schema, `${location} ${status}(${type})`),
            )
          }
        }
      }
    }

    expect(missing).toEqual([])
  })
})
