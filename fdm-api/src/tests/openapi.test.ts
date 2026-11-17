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
 * Resolves a local `#/components/schemas/<name>` reference.
 */
function resolveRef(ref: string, components: Record<string, SchemaNode>): SchemaNode | undefined {
  const prefix = "#/components/schemas/"
  return ref.startsWith(prefix) ? components[ref.slice(prefix.length)] : undefined
}

/**
 * Collects every property in a JSON schema that has no `description`.
 *
 * A property that is a `$ref` is documented when it has a description itself or when the
 * referenced component has one. The properties of a referenced component are checked on their own.
 */
function findUndocumentedProperties(
  schema: SchemaNode | undefined,
  path: string,
  components: Record<string, SchemaNode>,
): string[] {
  if (!schema || typeof schema !== "object" || "$ref" in schema) return []
  const missing: string[] = []
  for (const [name, property] of Object.entries<SchemaNode>(schema.properties ?? {})) {
    const propertyPath = `${path}.${name}`
    const description =
      property.description ??
      ("$ref" in property ? resolveRef(property.$ref, components)?.description : undefined)
    if (!description) missing.push(propertyPath)
    missing.push(...findUndocumentedProperties(property, propertyPath, components))
  }
  if (schema.items)
    missing.push(...findUndocumentedProperties(schema.items, `${path}[]`, components))
  for (const [index, item] of (schema.prefixItems ?? []).entries()) {
    missing.push(...findUndocumentedProperties(item, `${path}[${index}]`, components))
  }
  for (const keyword of ["anyOf", "oneOf", "allOf"] as const) {
    for (const [index, variant] of (schema[keyword] ?? []).entries()) {
      missing.push(
        ...findUndocumentedProperties(variant, `${path}<${keyword}:${index}>`, components),
      )
    }
  }
  if (typeof schema.additionalProperties === "object") {
    missing.push(
      ...findUndocumentedProperties(schema.additionalProperties, `${path}{}`, components),
    )
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

    const components: Record<string, SchemaNode> = spec.components?.schemas ?? {}
    const missing: string[] = []
    for (const [name, schema] of Object.entries(components)) {
      missing.push(...findUndocumentedProperties(schema, name, components))
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
          missing.push(
            ...findUndocumentedProperties(media.schema, `${location} body(${type})`, components),
          )
        }
        for (const [status, response] of Object.entries<SchemaNode>(operation.responses ?? {})) {
          for (const [type, media] of Object.entries<SchemaNode>(response.content ?? {})) {
            missing.push(
              ...findUndocumentedProperties(
                media.schema,
                `${location} ${status}(${type})`,
                components,
              ),
            )
          }
        }
      }
    }

    expect(missing).toEqual([])
  })

  it("accepts a referenced property only when it or its target is described", () => {
    const components = {
      Described: { type: "object", description: "A described component." },
      Undescribed: { type: "object" },
    }
    const schema = {
      properties: {
        inline: { type: "string" },
        viaTarget: { $ref: "#/components/schemas/Described" },
        viaProperty: { $ref: "#/components/schemas/Undescribed", description: "Described here." },
        missing: { $ref: "#/components/schemas/Undescribed" },
      },
    }

    expect(findUndocumentedProperties(schema, "Test", components)).toEqual([
      "Test.inline",
      "Test.missing",
    ])
  })
})
