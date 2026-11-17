import { beforeEach, describe, expect, it, vi } from "vitest"

const gcs = vi.hoisted(() => {
  class ApiError extends Error {
    code: number
    constructor(message: string, code: number) {
      super(message)
      this.code = code
    }
  }
  const file = {
    save: vi.fn(),
    getMetadata: vi.fn(),
    download: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    move: vi.fn(),
    getSignedUrl: vi.fn(),
    generateSignedPostPolicyV4: vi.fn(),
  }
  const bucket = { file: vi.fn(() => file) }
  const constructorArgs: unknown[] = []
  class Storage {
    constructor(options?: unknown) {
      constructorArgs.push(options)
    }
    bucket = vi.fn(() => bucket)
  }
  return { ApiError, Storage, file, bucket, constructorArgs }
})

vi.mock("@google-cloud/storage", () => ({ ApiError: gcs.ApiError, Storage: gcs.Storage }))

const { createGcsStorage, isGcsConfigured } = await import("./gcs")
const { FileNotFoundError } = await import("./types")

function networkError(code: string) {
  return Object.assign(new Error("network"), { code })
}

describe("createGcsStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const method of Object.values(gcs.file)) method.mockReset()
    gcs.constructorArgs.length = 0
    delete process.env.GCS_SERVICE_ACCOUNT_KEY
    delete process.env.GCS_SERVICE_ACCOUNT_EMAIL
    delete process.env.GCS_BUCKET_NAME
  })

  const storage = () => createGcsStorage({ bucketName: "bucket" })

  it("uploads a file with its content type", async () => {
    await storage().upload("a/1.pdf", Buffer.from("x"), "application/pdf")
    expect(gcs.bucket.file).toHaveBeenCalledWith("a/1.pdf")
    expect(gcs.file.save).toHaveBeenCalledWith(Buffer.from("x"), {
      contentType: "application/pdf",
      resumable: false,
    })
  })

  it("downloads a file with its content type", async () => {
    gcs.file.getMetadata.mockResolvedValue([{ contentType: "image/png" }])
    gcs.file.download.mockResolvedValue([Buffer.from("png")])
    expect(await storage().download("a/1.png")).toEqual({
      buffer: Buffer.from("png"),
      contentType: "image/png",
    })
  })

  it("returns no content type when the metadata has none", async () => {
    gcs.file.getMetadata.mockResolvedValue([{}])
    gcs.file.download.mockResolvedValue([Buffer.from("x")])
    expect((await storage().download("a/1")).contentType).toBeUndefined()
  })

  it.each([
    ["ECONNRESET", networkError("ECONNRESET")],
    ["socket hang up", new Error("socket hang up")],
  ])("retries a download once after %s", async (_, error) => {
    gcs.file.getMetadata.mockResolvedValue([{ contentType: "application/pdf" }])
    gcs.file.download.mockRejectedValueOnce(error).mockResolvedValueOnce([Buffer.from("ok")])
    expect((await storage().download("a/1.pdf")).buffer).toEqual(Buffer.from("ok"))
    expect(gcs.file.download).toHaveBeenCalledTimes(2)
  })

  it("does not retry an HTTP error or a non-network error", async () => {
    gcs.file.getMetadata.mockResolvedValue([{}])
    gcs.file.download.mockRejectedValue(new gcs.ApiError("forbidden", 403))
    await expect(storage().download("a/1.pdf")).rejects.toThrow("forbidden")
    expect(gcs.file.download).toHaveBeenCalledTimes(1)

    gcs.file.download.mockReset().mockRejectedValue("not an error")
    await expect(storage().download("a/1.pdf")).rejects.toBe("not an error")
    expect(gcs.file.download).toHaveBeenCalledTimes(1)
  })

  it("turns a missing file into FileNotFoundError", async () => {
    gcs.file.getMetadata.mockRejectedValue(new gcs.ApiError("not found", 404))
    gcs.file.download.mockResolvedValue([Buffer.from("x")])
    await expect(storage().download("missing")).rejects.toBeInstanceOf(FileNotFoundError)

    gcs.file.move.mockRejectedValue(new gcs.ApiError("not found", 404))
    await expect(storage().move("missing", "b")).rejects.toBeInstanceOf(FileNotFoundError)
  })

  it("passes other move errors on", async () => {
    gcs.file.move.mockRejectedValue(new gcs.ApiError("forbidden", 403))
    await expect(storage().move("a", "b")).rejects.toThrow("forbidden")
  })

  it("moves, deletes and checks files", async () => {
    gcs.file.exists.mockResolvedValue([true])
    const s = storage()
    await s.move("a", "b")
    await s.delete("a")
    expect(await s.exists("a")).toBe(true)
    expect(gcs.file.move).toHaveBeenCalledWith("b")
    expect(gcs.file.delete).toHaveBeenCalledWith({ ignoreNotFound: true })
  })

  it("creates signed URLs", async () => {
    gcs.file.getSignedUrl.mockResolvedValueOnce(["read-url"]).mockResolvedValueOnce(["put-url"])
    gcs.file.generateSignedPostPolicyV4.mockResolvedValue([{ url: "post-url" }])
    const s = storage()

    expect(await s.signedReadUrl("a")).toBe("read-url")
    expect(gcs.file.getSignedUrl.mock.calls[0]?.[0]).toMatchObject({
      version: "v4",
      action: "read",
    })

    expect(await s.generateSignedUploadUrl("a", "image/png")).toBe("post-url")
    expect(gcs.file.generateSignedPostPolicyV4.mock.calls[0]?.[0]).toMatchObject({
      conditions: [
        ["content-length-range", 1, 10 * 1024 * 1024],
        ["eq", "$Content-Type", "image/png"],
      ],
    })

    expect(await s.generateSignedPutUrl("a", "image/png", 5)).toEqual({
      uploadUrl: "put-url",
      objectKey: "a",
    })
    expect(gcs.file.getSignedUrl.mock.calls[1]?.[0]).toMatchObject({
      action: "write",
      contentType: "image/png",
      extensionHeaders: { "X-Goog-Content-Length-Range": "0,5" },
    })
  })

  it("fails on first use without a bucket name, not when it is created", async () => {
    const s = createGcsStorage()
    await expect(s.exists("a")).rejects.toThrow("GCS_BUCKET_NAME")
  })

  it("reads the bucket name from the environment", async () => {
    process.env.GCS_BUCKET_NAME = "env-bucket"
    gcs.file.exists.mockResolvedValue([false])
    expect(await createGcsStorage().exists("a")).toBe(false)
  })

  it("creates the client once, with an inline key, an email or the defaults", async () => {
    gcs.file.exists.mockResolvedValue([true])
    const key = Buffer.from(JSON.stringify({ client_email: "x" })).toString("base64")

    const withKey = createGcsStorage({ bucketName: "b", serviceAccountKey: key })
    await withKey.exists("a")
    await withKey.exists("b")
    await createGcsStorage({ bucketName: "b", serviceAccountEmail: "sa@example.com" }).exists("a")
    await createGcsStorage({ bucketName: "b" }).exists("a")

    expect(gcs.constructorArgs).toEqual([
      { credentials: { client_email: "x" } },
      { email: "sa@example.com" },
      undefined,
    ])
  })
})

describe("isGcsConfigured", () => {
  it("uses the environment when no name is given", () => {
    process.env.GCS_BUCKET_NAME = "bucket"
    expect(isGcsConfigured()).toBe(true)
    delete process.env.GCS_BUCKET_NAME
    expect(isGcsConfigured()).toBe(false)
  })
})
