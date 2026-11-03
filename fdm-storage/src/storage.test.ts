import { describe, expect, it } from "vitest"
import {
  buildObjectKey,
  createMemoryStorage,
  FileNotFoundError,
  InvalidUploadError,
  isGcsConfigured,
  readAndValidateFileUpload,
} from "./index"

const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89,
])
const PDF_HEADER = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n")

describe("buildObjectKey", () => {
  it("joins prefix, id and extension", () => {
    expect(buildObjectKey("soil_analysis", "abc", "pdf")).toBe("soil_analysis/abc.pdf")
  })
})

describe("isGcsConfigured", () => {
  it("is false for a blank bucket name", () => {
    expect(isGcsConfigured("  ")).toBe(false)
    expect(isGcsConfigured("")).toBe(false)
  })
  it("is true when a bucket name is set", () => {
    expect(isGcsConfigured("bucket")).toBe(true)
  })
})

describe("createMemoryStorage", () => {
  it("uploads, downloads, moves and deletes files", async () => {
    const storage = createMemoryStorage()
    await storage.upload("a/1.png", Buffer.from("x"), "image/png")
    expect(await storage.exists("a/1.png")).toBe(true)
    expect(await storage.download("a/1.png")).toEqual({
      buffer: Buffer.from("x"),
      contentType: "image/png",
    })

    await storage.move("a/1.png", "b/1.png")
    expect(storage.keys()).toEqual(["b/1.png"])

    await storage.delete("b/1.png")
    await storage.delete("b/1.png")
    expect(await storage.exists("b/1.png")).toBe(false)
  })

  it("throws FileNotFoundError for a missing file", async () => {
    const storage = createMemoryStorage()
    await expect(storage.download("missing")).rejects.toBeInstanceOf(FileNotFoundError)
    await expect(storage.move("missing", "x")).rejects.toBeInstanceOf(FileNotFoundError)
  })
})

describe("readAndValidateFileUpload", () => {
  it("detects the type from the contents, not the declared type", async () => {
    const file = new Blob([PNG_HEADER], { type: "application/pdf" })
    const result = await readAndValidateFileUpload(file, {
      allowedMimes: new Set(["image/png"]),
    })
    expect(result.mime).toBe("image/png")
    expect(result.buffer.length).toBe(PNG_HEADER.length)
  })

  it("accepts a PDF", async () => {
    const result = await readAndValidateFileUpload(new Blob([PDF_HEADER]), {
      allowedMimes: new Set(["application/pdf"]),
    })
    expect(result.mime).toBe("application/pdf")
  })

  it("rejects a type that is not allowed", async () => {
    const file = new Blob([PNG_HEADER], { type: "application/pdf" })
    await expect(
      readAndValidateFileUpload(file, { allowedMimes: new Set(["application/pdf"]) }),
    ).rejects.toMatchObject({ name: "InvalidUploadError", reason: "unsupported-type" })
  })

  it("rejects a file above the size limit", async () => {
    const error = await readAndValidateFileUpload(new Blob([new Uint8Array(11)]), {
      maxBytes: 10,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(InvalidUploadError)
    expect((error as InvalidUploadError).reason).toBe("too-large")
  })

  it("returns application/octet-stream for an unknown type when any type is allowed", async () => {
    const result = await readAndValidateFileUpload(new Blob([new Uint8Array([1, 2, 3])]))
    expect(result.mime).toBe("application/octet-stream")
  })
})
