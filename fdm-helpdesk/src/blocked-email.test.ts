import { describe, expect } from "vitest"
import { addAdminAgent, addAgent } from "./agent"
import {
  addEmailBlock,
  getEmailBlock,
  getEmailBlocks,
  getMatchingEmailBlock,
  removeEmailBlock,
} from "./blocked-email"
import { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { createId } from "./id"
import { test, truncateAllTables } from "./test-util"

describe("getEmailBlock", () => {
  let admin_id: string
  let email: string
  test.beforeEach(async ({ fdm }) => {
    admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Admin Agent")

    email = `${createId()}@example.com`
  })

  test("should return the blocked email record for a blocked email", async ({ fdm }) => {
    await addEmailBlock(fdm, admin_id, email, "Test reason")
    const result = await getEmailBlock(fdm, email)
    expect(result).not.toBeNull()
    expect(result?.email).toBe(email.toLowerCase())
    expect(result?.blocked_by).toBe(admin_id)
    expect(result?.reason).toBe("Test reason")
  })

  test("should match email block case-insensitive", async ({ fdm }) => {
    await addEmailBlock(fdm, admin_id, email, "Test reason")
    const result = await getEmailBlock(fdm, `${email.split("@")[0]}@EXAMPLE.COM`)
    expect(result).not.toBeNull()
    expect(result?.email).toBe(email.toLowerCase())
    expect(result?.blocked_by).toBe(admin_id)
    expect(result?.reason).toBe("Test reason")
  })

  test("should return null for an email that is not blocked", async ({ fdm }) => {
    const email = "good@example.com"
    const result = await getEmailBlock(fdm, email)
    expect(result).toBeNull()
  })

  test("should throw if the database connection fails", async () => {
    const fdm = {
      select() {
        throw new Error("Database connection failed")
      },
    } as unknown as FdmHelpdeskType

    await expect(getEmailBlock(fdm, email)).rejects.toThrow("Exception for getEmailBlock")
  })
})

describe("getMatchingEmailBlock", () => {
  let admin_id: string
  let domain: string
  let email: string
  test.beforeEach(async ({ fdm }) => {
    admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Admin Agent")

    domain = `${createId()}.com`
    email = `${createId()}@${domain}`
  })

  test("should return the block if the email is specifically blocked", async ({ fdm }) => {
    await addEmailBlock(fdm, admin_id, email, "Test reason")
    const result = await getMatchingEmailBlock(fdm, email)
    expect(result).not.toBeNull()
  })

  test("should return the block if the email's domain is blocked", async ({ fdm }) => {
    await addEmailBlock(fdm, admin_id, domain, "Test reason")
    const result = await getMatchingEmailBlock(fdm, `${createId()}@${domain}`)
    expect(result).not.toBeNull()
  })

  test("should return the block if the email's all subdomais are blocked", async ({ fdm }) => {
    await addEmailBlock(fdm, admin_id, `*.${domain}`, "Test reason")
    const result = await getMatchingEmailBlock(fdm, `${createId()}@${domain}`)
    expect(result).not.toBeNull()
  })

  test("should return the block if the email's subdomain is blocked due to all subdomais being blocked", async ({
    fdm,
  }) => {
    await addEmailBlock(fdm, admin_id, `*.${domain}`, "Test reason")
    const result = await getMatchingEmailBlock(fdm, `${createId()}@sub.${domain}`)
    expect(result).not.toBeNull()
  })

  test("should return a block for a blank email", async ({ fdm }) => {
    const result = await getMatchingEmailBlock(fdm, "    ")
    expect(result).not.toBeNull()
  })

  test("should return a block if domain of only one segment matches", async ({ fdm }) => {
    const result = await getMatchingEmailBlock(fdm, `${createId()}@example..com`)
    expect(result).not.toBeNull()
  })

  test("should return null for an email that is not blocked", async ({ fdm }) => {
    const email = "good@example.com"
    const result = await getMatchingEmailBlock(fdm, email)
    expect(result).toBeNull()
  })

  test("should throw if the database connection fails", async () => {
    const fdm = {
      select() {
        throw new Error("Database connection failed")
      },
    } as unknown as FdmHelpdeskType

    await expect(getMatchingEmailBlock(fdm, email)).rejects.toThrow(
      "Exception for getMatchingEmailBlock",
    )
  })
})

describe("getEmailBlocks", () => {
  let admin_id: string
  let agent_id: string
  let email1: string
  let email2: string
  let email3: string

  test.beforeEach(async ({ fdm }) => {
    await truncateAllTables(fdm)

    admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Admin Agent")

    agent_id = createId()
    await addAgent(fdm, admin_id, agent_id, "Regular Agent")

    email1 = `${createId()}@example.com`
    await addEmailBlock(fdm, admin_id, email1, "Violating the contract")
    email2 = `${createId()}@example.com`
    await addEmailBlock(fdm, admin_id, email2)
    email3 = `${createId()}@example.com`
    await addEmailBlock(fdm, admin_id, email3, "Because I wanted to")
  })

  test("should get all email blocks", async ({ fdm }) => {
    const blocks = await getEmailBlocks(fdm, admin_id)

    expect(blocks).toHaveLength(3)
    expect(blocks.map((block) => block.email.toLowerCase())).toEqual(
      [email1, email2, email3].map((email) => email.toLowerCase()).sort(),
    )
  })

  test("should get a page of email blocks", async ({ fdm }) => {
    const blocks = await getEmailBlocks(fdm, admin_id, { pageOffset: 1, pageLimit: 1 })

    expect(blocks).toHaveLength(1)
    expect(blocks.map((block) => block.email.toLowerCase())).toEqual([
      [email1, email2, email3].map((email) => email.toLowerCase()).sort()[1],
    ])
  })

  test("should search by email", async ({ fdm }) => {
    const blocks = await getEmailBlocks(fdm, admin_id, { text: email1 })

    expect(blocks).toHaveLength(1)
    expect(blocks.map((block) => block.email)).toEqual([email1.toLowerCase()])
  })

  test("should search by email even if reason is null", async ({ fdm }) => {
    const blocks = await getEmailBlocks(fdm, admin_id, { text: email2 })

    expect(blocks).toHaveLength(1)
    expect(blocks.map((block) => block.email)).toEqual([email2.toLowerCase()])
  })

  test("should search by reason", async ({ fdm }) => {
    const blocks = await getEmailBlocks(fdm, admin_id, { text: "Violating" })

    expect(blocks).toHaveLength(1)
    expect(blocks.map((block) => block.email)).toEqual([email1.toLowerCase()])
  })

  test("should search by text case-insensitively", async ({ fdm }) => {
    const blocks = await getEmailBlocks(fdm, admin_id, { text: "because i wanted to" })

    expect(blocks).toHaveLength(1)
    expect(blocks.map((block) => block.email)).toEqual([email3.toLowerCase()])
  })

  test("should not let regular agents list blocked emails", async ({ fdm }) => {
    await expect(getEmailBlocks(fdm, agent_id)).rejects.toThrow()
  })
})

describe("addEmailBlock", () => {
  let admin_id: string
  let agent_id: string
  let email: string
  test.beforeEach(async ({ fdm }) => {
    admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Admin Agent")

    agent_id = createId()
    await addAgent(fdm, admin_id, agent_id, "Regular Agent")

    email = `${createId()}@example.com`
  })

  test("should let admins add a blocked email", async ({ fdm }) => {
    await addEmailBlock(fdm, admin_id, email, "Test reason")
    const result = await getEmailBlock(fdm, email)
    expect(result).not.toBeNull()
    expect(result?.email).toBe(email.toLowerCase())
    expect(result?.blocked_by).toBe(admin_id)
    expect(result?.reason).toBe("Test reason")
  })

  test("should not let regular agents add a blocked email", async ({ fdm }) => {
    await expect(addEmailBlock(fdm, agent_id, email, "Test reason")).rejects.toThrow()
    const result = await getEmailBlock(fdm, email)
    expect(result).toBeNull()
  })

  test("should do nothing when adding a block on an email twice", async ({ fdm }) => {
    await addEmailBlock(fdm, admin_id, email, "Test reason")
    await addEmailBlock(fdm, admin_id, email, "Test reason 2")
    const result = await getEmailBlock(fdm, email)
    expect(result).not.toBeNull()
    expect(result?.email).toBe(email.toLowerCase())
    expect(result?.blocked_by).toBe(admin_id)
    expect(result?.reason).toBe("Test reason")
  })

  test("should do nothing when adding a block on an email twice with different case", async ({
    fdm,
  }) => {
    await addEmailBlock(fdm, admin_id, email, "Test reason")
    await addEmailBlock(fdm, admin_id, `${email.split("@")[0]}@EXAMPLE.COM`, "Test reason 2")
    const result = await getEmailBlock(fdm, email)
    expect(result).not.toBeNull()
    expect(result?.email).toBe(email.toLowerCase())
    expect(result?.blocked_by).toBe(admin_id)
    expect(result?.reason).toBe("Test reason")
  })
})

describe("removeEmailBlock", () => {
  let admin_id: string
  let agent_id: string
  let email: string
  let goodEmail: string
  test.beforeEach(async ({ fdm }) => {
    admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Admin Agent")

    agent_id = createId()
    await addAgent(fdm, admin_id, agent_id, "Regular Agent")

    email = `${createId()}@example.com`

    await addEmailBlock(fdm, admin_id, email, "Test reason")

    goodEmail = `${createId()}@example.com`
  })

  test("should let admins remove a blocked email", async ({ fdm }) => {
    await removeEmailBlock(fdm, admin_id, email)
    const result = await getEmailBlock(fdm, email)
    expect(result).toBeNull()
  })

  test("should let admins remove a blocked email with different case", async ({ fdm }) => {
    await removeEmailBlock(fdm, admin_id, email)
    const result = await getEmailBlock(fdm, `${email.split("@")[0]}@EXAMPLE.COM`)
    expect(result).toBeNull()
  })

  test("should not let regular agents remove a blocked email", async ({ fdm }) => {
    await expect(removeEmailBlock(fdm, agent_id, email)).rejects.toThrow()
    const result = await getEmailBlock(fdm, email)
    expect(result).not.toBeNull()
  })

  test("should do nothing when removing an email record that does not exist", async ({ fdm }) => {
    await removeEmailBlock(fdm, admin_id, goodEmail)
    const result = await getEmailBlock(fdm, goodEmail)
    expect(result).toBeNull()
  })
})
