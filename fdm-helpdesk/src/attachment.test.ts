import { describe, expect } from "vitest"
import { addAdminAgent } from "./agent"
import {
  addAttachment,
  getAttachment,
  getAttachmentsForMessage,
  getAttachmentsForTicket,
  removeAttachment,
} from "./attachment"
import { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { createId } from "./id"
import { addMessage, getMessagesForTicket } from "./message"
import { test } from "./test-util"
import { createTicket } from "./ticket"

async function createAttachmentGetterSeedData(fdm: FdmHelpdeskType) {
  const agent_id = createId()
  await addAdminAgent(fdm, agent_id, "Test Admin Agent")
  const user_id = createId()

  const user_ticket_id = await createTicket(fdm, user_id, "Test Ticket")
  const [user_ticket_message] = await getMessagesForTicket(fdm, user_id, user_ticket_id)
  const internal_message_id = await addMessage(
    fdm,
    user_ticket_id,
    agent_id,
    "agent",
    "Test Internal Message",
    true,
  )
  const no_attachments_message_id = await addMessage(
    fdm,
    user_ticket_id,
    user_id,
    "customer",
    "Test Message With No Attachments",
  )
  const removed_attachment_message_id = await addMessage(
    fdm,
    user_ticket_id,
    user_id,
    "customer",
    "Test Message With Deleted Attachment",
  )

  const other_ticket_id = await createTicket(fdm, agent_id, "Test Other Ticket")
  const [other_ticket_message] = await getMessagesForTicket(fdm, agent_id, other_ticket_id)

  const user_attachment_id = await addAttachment(
    fdm,
    user_id,
    user_ticket_message.message_id,
    "cat.jpg",
    67_000_000,
    "image/jpeg",
    "helpdesk_attachment/cat.jpg",
    user_id,
  )
  const internal_attachment_id = await addAttachment(
    fdm,
    agent_id,
    internal_message_id,
    "dog.webp",
    52_000_000,
    "image/webp",
    "helpdesk_attachment/dog.webp",
    agent_id,
  )
  const other_attachment_id = await addAttachment(
    fdm,
    agent_id,
    other_ticket_message.message_id,
    "gopher.svg",
    64_000,
    "image/svg+xml",
    "helpdesk_attachment/gopher.svg",
    agent_id,
  )
  const removed_attachment_id = await addAttachment(
    fdm,
    user_id,
    removed_attachment_message_id,
    "cat.jpg",
    67_000_000,
    "image/jpeg",
    "helpdesk_attachment/cat.jpg",
    user_id,
  )
  await removeAttachment(fdm, user_id, removed_attachment_id)

  return {
    agent_id,
    user_id,
    user_ticket_id,
    user_attachment_id,
    user_message_id: user_ticket_message.message_id,
    other_ticket_id,
    other_message_id: other_ticket_message.message_id,
    other_attachment_id: other_attachment_id,
    internal_message_id,
    internal_attachment_id,
    no_attachments_message_id,
    removed_attachment_message_id,
    removed_attachment_id,
  }
}
type AttachmentGetterSeedData = Awaited<ReturnType<typeof createAttachmentGetterSeedData>>

describe("getAttachment", () => {
  let seed: AttachmentGetterSeedData

  test.beforeAll(async ({ fdm }) => {
    seed = await createAttachmentGetterSeedData(fdm)
  })

  test("should let the regular users see their own attachments", async ({ fdm }) => {
    await expect(getAttachment(fdm, seed.user_id, seed.user_attachment_id)).resolves.toEqual(
      expect.objectContaining({
        attachment_id: seed.user_attachment_id,
        uploaded_by: seed.user_id,
        message_id: seed.user_message_id,
        file_name: "cat.jpg",
        file_size: 67_000_000,
        mime_type: "image/jpeg",
        file_path: "helpdesk_attachment/cat.jpg",
      }),
    )
  })

  test("should not let regular users see attachments under internal messages", async ({ fdm }) => {
    await expect(getAttachment(fdm, seed.user_id, seed.internal_attachment_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should not let regular users see attachments under other people's tickets", async ({
    fdm,
  }) => {
    await expect(getAttachment(fdm, seed.user_id, seed.other_attachment_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should let agents see attachments under internal messages", async ({ fdm }) => {
    await expect(getAttachment(fdm, seed.agent_id, seed.internal_attachment_id)).resolves.toEqual(
      expect.objectContaining({
        attachment_id: seed.internal_attachment_id,
        uploaded_by: seed.agent_id,
        ticket_id: seed.user_ticket_id,
        message_id: seed.internal_message_id,
        file_name: "dog.webp",
        file_size: 52_000_000,
        mime_type: "image/webp",
        file_path: "helpdesk_attachment/dog.webp",
      }),
    )
  })

  test("should let agents see attachments under other people's tickets", async ({ fdm }) => {
    await expect(getAttachment(fdm, seed.agent_id, seed.user_attachment_id)).resolves.toEqual(
      expect.objectContaining({
        attachment_id: seed.user_attachment_id,
        uploaded_by: seed.user_id,
        ticket_id: seed.user_ticket_id,
        message_id: seed.user_message_id,
        file_name: "cat.jpg",
        file_size: 67_000_000,
        mime_type: "image/jpeg",
        file_path: "helpdesk_attachment/cat.jpg",
      }),
    )
  })

  test("should not get a removed attachment", async ({ fdm }) => {
    await expect(getAttachment(fdm, seed.agent_id, seed.removed_attachment_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })
})

describe("getAttachmentsForMessage", () => {
  let seed: AttachmentGetterSeedData

  test.beforeAll(async ({ fdm }) => {
    seed = await createAttachmentGetterSeedData(fdm)
  })

  test("should let the regular users see only non-internal attachments", async ({ fdm }) => {
    await expect(
      getAttachmentsForMessage(fdm, seed.user_id, seed.user_message_id),
    ).resolves.toEqual([
      expect.objectContaining({
        attachment_id: seed.user_attachment_id,
        uploaded_by: seed.user_id,
        message_id: seed.user_message_id,
        file_name: "cat.jpg",
        file_size: 67_000_000,
        mime_type: "image/jpeg",
        file_path: "helpdesk_attachment/cat.jpg",
      }),
    ])
  })

  test("should not let regular users see attachments under internal messages", async ({ fdm }) => {
    await expect(
      getAttachmentsForMessage(fdm, seed.user_id, seed.internal_message_id),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })

  test("should not let regular users see attachments under other people's tickets", async ({
    fdm,
  }) => {
    await expect(
      getAttachmentsForMessage(fdm, seed.user_id, seed.other_message_id),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })

  test("should let agents see attachments under internal messages", async ({ fdm }) => {
    await expect(
      getAttachmentsForMessage(fdm, seed.agent_id, seed.internal_message_id),
    ).resolves.toEqual([
      expect.objectContaining({
        attachment_id: seed.internal_attachment_id,
        uploaded_by: seed.agent_id,
        ticket_id: seed.user_ticket_id,
        message_id: seed.internal_message_id,
        file_name: "dog.webp",
        file_size: 52_000_000,
        mime_type: "image/webp",
        file_path: "helpdesk_attachment/dog.webp",
      }),
    ])
  })

  test("should let agents see attachments under other people's tickets", async ({ fdm }) => {
    await expect(
      getAttachmentsForMessage(fdm, seed.agent_id, seed.user_message_id),
    ).resolves.toEqual([
      expect.objectContaining({
        attachment_id: seed.user_attachment_id,
        uploaded_by: seed.user_id,
        ticket_id: seed.user_ticket_id,
        message_id: seed.user_message_id,
        file_name: "cat.jpg",
        file_size: 67_000_000,
        mime_type: "image/jpeg",
        file_path: "helpdesk_attachment/cat.jpg",
      }),
    ])
  })
})

describe("getAttachmentsForTicket", () => {
  let seed: AttachmentGetterSeedData

  test.beforeAll(async ({ fdm }) => {
    seed = await createAttachmentGetterSeedData(fdm)
  })

  test("should let the regular users see only non-internal attachments", async ({ fdm }) => {
    const ticketAttachments = await getAttachmentsForTicket(fdm, seed.user_id, seed.user_ticket_id)
    expect(ticketAttachments.size).toBe(1)
    expect(
      ticketAttachments.has(seed.user_message_id),
      "did not retrieve attachments for the main ticket message",
    ).toBe(true)
    expect(
      ticketAttachments.has(seed.no_attachments_message_id),
      "contained key for message with no attachments",
    ).toBe(false)
    const userMessageAttachments = ticketAttachments.get(seed.user_message_id)
    expect(userMessageAttachments).toEqual([
      expect.objectContaining({
        attachment_id: seed.user_attachment_id,
        uploaded_by: seed.user_id,
        message_id: seed.user_message_id,
        file_name: "cat.jpg",
        file_size: 67_000_000,
        mime_type: "image/jpeg",
        file_path: "helpdesk_attachment/cat.jpg",
      }),
    ])
  })

  test("should not let regular users see attachments under other people's tickets", async ({
    fdm,
  }) => {
    await expect(getAttachmentsForTicket(fdm, seed.user_id, seed.other_ticket_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should let agents see attachments under internal messages", async ({ fdm }) => {
    const ticketAttachments = await getAttachmentsForTicket(fdm, seed.agent_id, seed.user_ticket_id)
    expect(ticketAttachments.size).toBe(2)
    expect(
      ticketAttachments.has(seed.user_message_id),
      "did not retrieve attachments for the main ticket message",
    ).toBe(true)
    expect(
      ticketAttachments.has(seed.internal_message_id),
      "did not retrieve attachments for the internal ticket message",
    ).toBe(true)
    expect(
      ticketAttachments.has(seed.no_attachments_message_id),
      "contained key for message with no attachments",
    ).toBe(false)
    expect(
      ticketAttachments.has(seed.removed_attachment_message_id),
      "contained key for message with a removed attachment",
    ).toBe(false)
    const userMessageAttachments = ticketAttachments.get(seed.user_message_id)
    const internalMessageAttachments = ticketAttachments.get(seed.internal_message_id)
    expect(userMessageAttachments).toEqual([
      expect.objectContaining({
        attachment_id: seed.user_attachment_id,
        uploaded_by: seed.user_id,
        ticket_id: seed.user_ticket_id,
        message_id: seed.user_message_id,
        file_name: "cat.jpg",
        file_size: 67_000_000,
        mime_type: "image/jpeg",
        file_path: "helpdesk_attachment/cat.jpg",
      }),
    ])
    expect(internalMessageAttachments).toEqual([
      expect.objectContaining({
        attachment_id: seed.internal_attachment_id,
        uploaded_by: seed.agent_id,
        ticket_id: seed.user_ticket_id,
        message_id: seed.internal_message_id,
        file_name: "dog.webp",
        file_size: 52_000_000,
        mime_type: "image/webp",
        file_path: "helpdesk_attachment/dog.webp",
      }),
    ])
  })

  test("should get multiple attachments on the same message", async ({ fdm }) => {
    const ticket_id = await createTicket(fdm, seed.user_id, "Test Ticket With Multiple Attachments")
    const [message] = await getMessagesForTicket(fdm, seed.user_id, ticket_id)
    await addAttachment(
      fdm,
      seed.user_id,
      message.message_id,
      "fat-cat.jpg",
      67_000_000,
      "image/jpeg",
      "helpdesk_attachment/fat-cat.jpg",
      seed.user_id,
    )
    await addAttachment(
      fdm,
      seed.user_id,
      message.message_id,
      "slim-cat.jpg",
      21_000_000,
      "image/jpeg",
      "helpdesk_attachment/slim-cat.jpg",
      seed.user_id,
    )

    const ticketAttachments = await getAttachmentsForTicket(fdm, seed.user_id, ticket_id)
    expect(ticketAttachments.size).toBe(1)
    expect(
      ticketAttachments.has(message.message_id),
      "did not retrieve attachments for the main ticket message",
    ).toBe(true)
    expect(ticketAttachments.get(message.message_id)).toHaveLength(2)
  })
})

describe("addAttachment", () => {
  let agent_id: string
  let user_id: string
  let ticket_id: string
  let user_message_id: string
  let other_message_id: string

  test.beforeEach(async ({ fdm }) => {
    agent_id = createId()
    await addAdminAgent(fdm, agent_id, "Test Admin Agent")
    user_id = createId()

    ticket_id = await createTicket(fdm, user_id, "Test Ticket")
    const [user_message] = await getMessagesForTicket(fdm, user_id, ticket_id)
    user_message_id = user_message.message_id
    other_message_id = await addMessage(fdm, ticket_id, agent_id, "agent", "Test Message")
  })

  test("should let regular users add attachments to their own messages", async ({ fdm }) => {
    const attachment_id = await addAttachment(
      fdm,
      user_id,
      user_message_id,
      "cat.png",
      5_000_000,
      "image/png",
      "helpdesk_attachment/cat.png",
      user_id,
    )

    await expect(getAttachment(fdm, user_id, attachment_id)).resolves.toEqual(
      expect.objectContaining({
        ticket_id: ticket_id,
        message_id: user_message_id,
        file_name: "cat.png",
        file_size: 5_000_000,
        mime_type: "image/png",
        file_path: "helpdesk_attachment/cat.png",
        uploaded_by: user_id,
      }),
    )
  })

  test("should not let regular users add attachments to other people's messages", async ({
    fdm,
  }) => {
    await expect(
      addAttachment(
        fdm,
        user_id,
        other_message_id,
        "cat.png",
        5_000_000,
        "image/png",
        "helpdesk_attachment/cat.png",
        user_id,
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")

    await expect(getAttachmentsForMessage(fdm, user_id, other_message_id)).resolves.toHaveLength(0)
  })

  test("should let agents add attachments to any message", async ({ fdm }) => {
    const attachment_id = await addAttachment(
      fdm,
      agent_id,
      user_message_id,
      "cat.png",
      5_000_000,
      "image/png",
      "helpdesk_attachment/cat.png",
      agent_id,
    )

    await expect(getAttachment(fdm, user_id, attachment_id)).resolves.toEqual(
      expect.objectContaining({
        ticket_id: ticket_id,
        message_id: user_message_id,
        file_name: "cat.png",
        file_size: 5_000_000,
        mime_type: "image/png",
        file_path: "helpdesk_attachment/cat.png",
        uploaded_by: agent_id,
      }),
    )
  })

  test("should substitute {attachment_id} in the file_path with the generated ID", async ({
    fdm,
  }) => {
    const attachment_id = await addAttachment(
      fdm,
      user_id,
      user_message_id,
      "cat.png",
      5_000_000,
      "image/png",
      "helpdesk_attachment/{attachment_id}",
      user_id,
    )

    const attachment = await getAttachment(fdm, user_id, attachment_id)

    expect(attachment.file_path).toBe(`helpdesk_attachment/${attachment_id}`)
  })
})

describe("removeAttachment", () => {
  let agent_id: string
  let user_id: string
  let ticket_id: string
  let user_message_id: string
  let other_message_id: string
  let user_attachment_id: string
  let other_attachment_id: string

  test.beforeEach(async ({ fdm }) => {
    agent_id = createId()
    await addAdminAgent(fdm, agent_id, "Test Admin Agent")
    user_id = createId()

    ticket_id = await createTicket(fdm, user_id, "Test Ticket")
    const [user_message] = await getMessagesForTicket(fdm, user_id, ticket_id)
    user_message_id = user_message.message_id
    other_message_id = await addMessage(fdm, ticket_id, agent_id, "agent", "Test Message")
    user_attachment_id = await addAttachment(
      fdm,
      user_id,
      user_message_id,
      "cat.png",
      5_000_000,
      "image/png",
      "helpdesk_attachment/cat.png",
      user_id,
    )
    other_attachment_id = await addAttachment(
      fdm,
      agent_id,
      other_message_id,
      "dog.webp",
      5_000_000,
      "image/webp",
      "helpdesk_attachment/dog.webp",
      agent_id,
    )
  })

  test("should let regular users remove attachments on their own messages", async ({ fdm }) => {
    await removeAttachment(fdm, user_id, user_attachment_id)

    await expect(getAttachment(fdm, user_id, user_attachment_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should not let regular users remove attachments on other people's messages", async ({
    fdm,
  }) => {
    await expect(removeAttachment(fdm, user_id, other_attachment_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )

    await expect(getAttachment(fdm, user_id, other_attachment_id)).resolves.toEqual(
      expect.objectContaining({ deleted_at: null }),
    )
  })

  test("should let agents remove attachments on any message", async ({ fdm }) => {
    await removeAttachment(fdm, agent_id, user_attachment_id)

    await expect(getAttachment(fdm, user_id, user_attachment_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should let users remove attachments from their message even if it is attached by someone else", async ({
    fdm,
  }) => {
    const foreign_attachment_id = await addAttachment(
      fdm,
      agent_id,
      user_message_id,
      "dog.webp",
      5_000_000,
      "image/webp",
      "helpdesk_attachment/dog.webp",
      agent_id,
    )
    await removeAttachment(fdm, user_id, foreign_attachment_id)

    await expect(getAttachment(fdm, user_id, foreign_attachment_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should return false if the attachment was already removed", async ({ fdm }) => {
    await removeAttachment(fdm, user_id, user_attachment_id)
    await expect(removeAttachment(fdm, user_id, user_attachment_id)).resolves.toBe(false)
  })

  test("should throw if the attachment with the given ID has never existed", async ({ fdm }) => {
    await expect(removeAttachment(fdm, user_id, "invalid-attachment")).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })
})
