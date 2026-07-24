import { describe, expect } from "vitest"
import { addAdminAgent, addAgent } from "./agent"
import { createId } from "./id"
import {
  applySavedReply,
  createSavedReply,
  deleteSavedReply,
  getSavedReplies,
  getSavedReply,
  makeSavedReplyBodySimple,
  updateSavedReply,
} from "./saved-reply"
import { test, truncateAllTables } from "./test-util"

describe("createSavedReply", () => {
  let agent_id: string

  test.beforeEach(async ({ fdm }) => {
    agent_id = createId()
    await addAdminAgent(fdm, agent_id, "Test Admin Agent")
  })

  test("should create a saved reply", async ({ fdm }) => {
    await createSavedReply(
      fdm,
      "Polite Response",
      "Dear sir/madam,\n\nWe are thankful to you for working with our company. We wish you are pleasant day.\n\nKind regards,\n{agent_name}",
      agent_id,
    )
  })

  test("should not let regular users create saved replies", async ({ fdm }) => {
    await expect(
      createSavedReply(
        fdm,
        "Polite Response",
        "Dear sir/madam,\n\nWe are thankful to you for working with our company. We wish you are pleasant day.\n\nKind regards,\n{agent_name}",
        createId(),
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })
})

describe("getSavedReplies", () => {
  let admin_id: string
  let agent_id: string

  let reply_id_1: string
  let reply_id_2: string
  let reply_id_3: string

  test.beforeEach(async ({ fdm }) => {
    await truncateAllTables(fdm)

    admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Test Admin Agent")
    agent_id = createId()
    await addAgent(fdm, admin_id, agent_id, "Test Regular Agent")

    // Admin's private saved reply
    reply_id_1 = await createSavedReply(
      fdm,
      "Impolite Response",
      "Hey,\n\nCheers bro it was great knowing you m8.\n\nSee ya! ^o^/",
      admin_id,
      "common",
      false,
    )
    // Admin's shared saved reply
    reply_id_2 = await createSavedReply(
      fdm,
      "Polite Response",
      "Dear sir/madam,\n\nWe are thankful to you for working with our company. We wish you are pleasant day.\n\nKind regards,\n{{agent_name}}",
      admin_id,
      "common",
      true,
    )
    // Agent's private saved reply. The admin can also see this.
    reply_id_3 = await createSavedReply(
      fdm,
      "Escalation",
      "Dear {{customer_name}},\n\nI will be escalating this to one of our admins. Thank you for your patience.\n\nSincerely,\n{{agent_name}}",
      agent_id,
      "common",
      false,
    )
  })

  test("admins should be able to see all saved replies", async ({ fdm }) => {
    const savedReplies = await getSavedReplies(fdm, admin_id)
    expect(savedReplies).toHaveLength(3)
    expect(savedReplies.some((r) => r.reply_id === reply_id_1)).toBe(true)
    expect(savedReplies.some((r) => r.reply_id === reply_id_2)).toBe(true)
    expect(savedReplies.some((r) => r.reply_id === reply_id_3)).toBe(true)
  })

  test("agents should be able to see only their own and shared saved replies", async ({ fdm }) => {
    const savedReplies = await getSavedReplies(fdm, agent_id)
    expect(savedReplies).toHaveLength(2)
    expect(savedReplies.some((r) => r.reply_id === reply_id_2)).toBe(true)
    expect(savedReplies.some((r) => r.reply_id === reply_id_3)).toBe(true)
  })

  test("regular users should get an exception when they try to get saved replies", async ({
    fdm,
  }) => {
    await expect(getSavedReplies(fdm, createId())).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })
})

describe("updateSavedReply", () => {
  let agent_id: string
  let other_agent_id: string
  let other_admin_id: string
  let private_reply_id: string
  let shared_reply_id: string

  test.beforeEach(async ({ fdm }) => {
    other_admin_id = createId()
    await addAdminAgent(fdm, other_admin_id, "Test Other Admin Agent")

    agent_id = createId()
    await addAgent(fdm, other_admin_id, agent_id, "Test Support Agent")

    other_agent_id = createId()
    await addAgent(fdm, other_admin_id, other_agent_id, "Test Other Support Agent")

    private_reply_id = await createSavedReply(
      fdm,
      "Polite Response",
      "Dear sir/madam,\n\nWe are thankful to you for working with our company. We wish you are pleasant day.\n\nKind regards,\n{agent_name}",
      agent_id,
      "generic",
      false,
    )

    shared_reply_id = await createSavedReply(
      fdm,
      "Polite Response",
      "Dear sir/madam,\n\nWe are thankful to you for working with our company. We wish you are pleasant day.\n\nKind regards,\n{agent_name}",
      agent_id,
      "generic",
      true,
    )
  })

  test("should let agents update their own saved replies", async ({ fdm }) => {
    await updateSavedReply(
      fdm,
      agent_id,
      private_reply_id,
      "Greeting to the World",
      "Hello, world",
      "humanitarian",
      true,
    )

    const updated = await getSavedReply(fdm, agent_id, private_reply_id)
    expect(updated.body).toBe("Hello, world")
    expect(updated.title).toBe("Greeting to the World")
    expect(updated.category).toBe("humanitarian")
    expect(updated.is_shared).toBe(true)
  })

  test("should let skip fields when updating", async ({ fdm }) => {
    await updateSavedReply(fdm, agent_id, shared_reply_id)

    const updated = await getSavedReply(fdm, agent_id, shared_reply_id)
    expect(updated.title).toBe("Polite Response")
    expect(updated.body).toBe(
      "Dear sir/madam,\n\nWe are thankful to you for working with our company. We wish you are pleasant day.\n\nKind regards,\n{agent_name}",
    )
    expect(updated.category).toBe("generic")
    expect(updated.is_shared).toBe(true)
  })

  test("should let admins edit any saved reply", async ({ fdm }) => {
    await updateSavedReply(
      fdm,
      other_admin_id,
      private_reply_id,
      "Greeting to the World",
      "Hello, world",
      "humanitarian",
      true,
    )

    const updated = await getSavedReply(fdm, other_admin_id, private_reply_id)
    expect(updated.body).toBe("Hello, world")
    expect(updated.title).toBe("Greeting to the World")
    expect(updated.category).toBe("humanitarian")
    expect(updated.is_shared).toBe(true)
  })

  test("should not let agents edit other agent's saved replies", async ({ fdm }) => {
    await expect(
      updateSavedReply(
        fdm,
        other_agent_id,
        private_reply_id,
        "Greeting to the World",
        "Hello, world",
        "humanitarian",
        true,
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })

  test("should not let agents delete other agent's shared saved reply", async ({ fdm }) => {
    await expect(
      updateSavedReply(
        fdm,
        other_agent_id,
        private_reply_id,
        "Greeting to the World",
        "Hello, world",
        "humanitarian",
        true,
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })

  test("should not let regular users update saved replies", async ({ fdm }) => {
    await expect(
      updateSavedReply(
        fdm,
        createId(),
        private_reply_id,
        "Greeting to the World",
        "Hello, world",
        "humanitarian",
        true,
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })

  test("should not let update a nonexistent saved reply", async ({ fdm }) => {
    await expect(
      updateSavedReply(
        fdm,
        other_admin_id,
        createId(),
        "Greeting to the World",
        "Hello, world",
        "humanitarian",
        true,
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })
})

describe("deleteSavedReply", () => {
  let agent_id: string
  let other_agent_id: string
  let other_admin_id: string
  let private_reply_id: string
  let shared_reply_id: string

  test.beforeEach(async ({ fdm }) => {
    other_admin_id = createId()
    await addAdminAgent(fdm, other_admin_id, "Test Other Admin Agent")

    agent_id = createId()
    await addAgent(fdm, other_admin_id, agent_id, "Test Support Agent")

    other_agent_id = createId()
    await addAgent(fdm, other_admin_id, other_agent_id, "Test Other Support Agent")

    private_reply_id = await createSavedReply(
      fdm,
      "Polite Response",
      "Dear sir/madam,\n\nWe are thankful to you for working with our company. We wish you are pleasant day.\n\nKind regards,\n{agent_name}",
      agent_id,
      "generic",
      false,
    )

    shared_reply_id = await createSavedReply(
      fdm,
      "Polite Response",
      "Dear sir/madam,\n\nWe are thankful to you for working with our company. We wish you are pleasant day.\n\nKind regards,\n{agent_name}",
      agent_id,
      "generic",
      true,
    )
  })

  test("should let agents delete their own saved replies", async ({ fdm }) => {
    await deleteSavedReply(fdm, agent_id, private_reply_id)

    await expect(getSavedReply(fdm, agent_id, private_reply_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should let admins delete any saved reply", async ({ fdm }) => {
    await deleteSavedReply(fdm, other_admin_id, private_reply_id)

    await expect(getSavedReply(fdm, other_admin_id, private_reply_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should not let agents delete other agent's saved replies", async ({ fdm }) => {
    await expect(deleteSavedReply(fdm, other_agent_id, private_reply_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should not let agents delete other agent's shared saved replies", async ({ fdm }) => {
    await expect(deleteSavedReply(fdm, other_agent_id, shared_reply_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should not let regular users delete saved replies", async ({ fdm }) => {
    await expect(deleteSavedReply(fdm, createId(), private_reply_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should not let delete a nonexistent saved reply", async ({ fdm }) => {
    await expect(deleteSavedReply(fdm, other_admin_id, createId())).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })
})

describe("getSavedReply", () => {
  let admin_id: string
  let agent_id: string

  let reply_id_1: string
  let reply_id_2: string
  let reply_id_3: string

  test.beforeEach(async ({ fdm }) => {
    await truncateAllTables(fdm)

    admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Test Admin Agent")
    agent_id = createId()
    await addAgent(fdm, admin_id, agent_id, "Test Regular Agent")

    // Admin's private saved reply
    reply_id_1 = await createSavedReply(
      fdm,
      "Impolite Response",
      "Hey,\n\nCheers bro it was great knowing you m8.\n\nSee ya! ^o^/",
      admin_id,
      "common",
      false,
    )
    // Admin's shared saved reply
    reply_id_2 = await createSavedReply(
      fdm,
      "Polite Response",
      "Dear sir/madam,\n\nWe are thankful to you for working with our company. We wish you are pleasant day.\n\nKind regards,\n{{agent_name}}",
      admin_id,
      "common",
      true,
    )
    // Agent's private saved reply. The admin can also see this.
    reply_id_3 = await createSavedReply(
      fdm,
      "Escalation",
      "Dear {{customer_name}},\n\nI will be escalating this to one of our admins. Thank you for your patience.\n\nSincerely,\n{{agent_name}}",
      agent_id,
      "common",
      false,
    )
  })

  test("should get agent's own saved reply", async ({ fdm }) => {
    const savedReply = await getSavedReply(fdm, agent_id, reply_id_3)
    expect(savedReply).toBeDefined()
    expect(savedReply?.reply_id).toBe(reply_id_3)
  })

  test("should get other agent's shared saved reply", async ({ fdm }) => {
    const savedReply = await getSavedReply(fdm, agent_id, reply_id_2)
    expect(savedReply).toBeDefined()
    expect(savedReply?.reply_id).toBe(reply_id_2)
  })

  test("should throw an error when getting a private saved reply of another agent", async ({
    fdm,
  }) => {
    await expect(getSavedReply(fdm, agent_id, reply_id_1)).rejects.toThrow()
  })
})

describe("makeSavedReplyBodySimple", () => {
  test("should find the substitution points", () => {
    const context = {
      customer_name: "Jane Doe",
      agent_name: "Bond, James Bond",
    }

    const message = `Hello Jane Doe,
I hope you are having a great day. I won't help you.

Sincerely,
Bond,
James Bond`
    const savedReply = makeSavedReplyBodySimple(message, context)

    expect(savedReply).toBe(`Hello {{customer_name}},
I hope you are having a great day. I won't help you.

Sincerely,
{{agent_name}}`)
  })

  test("should handle substitutions that are punctuation-only", () => {
    const context = {
      signature: ",,,",
    }

    const message = "Greetings,,,"

    expect(makeSavedReplyBodySimple(message, context)).toBe("Greetings,,,")
  })

  test("should handle empty substitutions", () => {
    const context = {
      empty: "",
    }

    const message = "This is an empty substitution: "

    expect(makeSavedReplyBodySimple(message, context)).toBe("This is an empty substitution: ")
  })

  test("should handle invalid keys", () => {
    const context = {
      "invalid-key": "value",
    }
    const message = "This is an invalid key: "

    expect(() => makeSavedReplyBodySimple(message, context)).toThrow()
  })
})

describe("applySavedReply", () => {
  test("should replace the substitution points with the context values", () => {
    const context = {
      customer_name: "Jane Doe",
    }
    const savedReply = "Hello, {{customer_name}}!"

    expect(applySavedReply(savedReply, context)).toBe("Hello, Jane Doe!")
  })

  test("should throw an error when there is a problem with a context key", () => {
    const context = {
      "@customer_name": "Jane Doe",
    }
    const savedReply = "Hello, {{@customer_name}}!"

    expect(() => applySavedReply(savedReply, context)).toThrow("Exception for applySavedReply")
  })
})
