import { eq } from "drizzle-orm"
import { describe, expect } from "vitest"
import { addAdminAgent } from "./agent"
import * as schema from "./db/schema-helpdesk"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { createId } from "./id"
import {
    addMessage,
    deleteMessage,
    getMessage,
    getMessagesForTicket,
    updateMessage,
} from "./message"
import { test } from "./test-util"
import { createTicket } from "./ticket"

describe("Message CRUD", () => {
    let admin_id: string
    let requester_id: string
    let other_user_id: string
    let ticket_id: string

    test.beforeEach(async ({ fdm }) => {
        // Create admin user
        admin_id = createId()

        await addAdminAgent(fdm, admin_id, "Helpdesk Agent")

        // Create requester user
        requester_id = createId()

        // Create another regular user
        other_user_id = createId()

        ticket_id = await createTicket(
            fdm,
            requester_id,
            `Seed message ${createId(8)}`,
        )
    })

    test("should persist a customer message", async ({ fdm }) => {
        const body = `Customer message ${createId(8)}`

        const message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            body,
        )

        const message = await getMessage(fdm, admin_id, message_id)

        expect(message.sender_id).toBe(requester_id)
        expect(message.sender_type).toBe("customer")
        expect(message.body).toBe(body)
        expect(message.is_internal).toBe(false)
    })

    test("should reject internal messages by regular users", async ({
        fdm,
    }) => {
        await expect(
            addMessage(
                fdm,
                ticket_id,
                requester_id,
                "customer",
                `Internal note attempt ${createId(8)}`,
                true,
            ),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })

    test("should hide internal messages from regular users", async ({
        fdm,
    }) => {
        const customer_message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Public Message",
        )
        const internal_message_id = await addMessage(
            fdm,
            ticket_id,
            admin_id,
            "agent",
            "Internal Message",
            true,
        )

        const requesterMessages = await getMessagesForTicket(
            fdm,
            requester_id,
            ticket_id,
            {
                includeDeleted: false,
            },
        )

        expect(
            requesterMessages.some(
                (msg) => msg.message_id === customer_message_id,
            ),
            "Expected regular user to see non-internal messages",
        ).toBe(true)
        expect(
            requesterMessages.some(
                (msg) => msg.message_id === internal_message_id,
            ),
            "Expected regular user to not see internal messages",
        ).toBe(false)
    })

    test("should support includeDeleted and sender filter for agents", async ({
        fdm,
    }) => {
        const deleted_message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Deleted Message",
        )
        const active_message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Active Message",
        )

        await deleteMessage(fdm, requester_id, deleted_message_id)

        const withoutDeleted = await getMessagesForTicket(
            fdm,
            admin_id,
            ticket_id,
            {
                includeDeleted: false,
            },
        )

        const withDeleted = await getMessagesForTicket(
            fdm,
            admin_id,
            ticket_id,
            {
                includeDeleted: true,
            },
        )

        expect(
            withoutDeleted.some((msg) => msg.message_id === deleted_message_id),
        ).toBe(false)
        expect(
            withDeleted.some((msg) => msg.message_id === deleted_message_id),
        ).toBe(true)
        expect(
            withDeleted.some((msg) => msg.message_id === active_message_id),
        ).toBe(true)
    })

    test("should reject includeDeleted for regular users", async ({ fdm }) => {
        await expect(
            getMessagesForTicket(fdm, requester_id, ticket_id, {
                includeDeleted: true,
            }),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })

    test("should update message body", async ({ fdm }) => {
        const message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Original Message Body",
        )

        await updateMessage(
            fdm,
            requester_id,
            message_id,
            "Updated Message Body",
        )

        const message = await getMessage(fdm, requester_id, message_id)

        expect(message.body).toBe("Updated Message Body")
        expect(message.updated).toBeTruthy()
    })

    test("should escape message body when adding", async ({ fdm }) => {
        const message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            `"test"<script>alert('xss')</script>`,
        )

        const message = await getMessage(fdm, requester_id, message_id)

        expect(message.body).toBe(
            "&quot;test&quot;&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
        )
    })

    test("should escape message body when updating", async ({ fdm }) => {
        const message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Safe Message Body",
        )

        await updateMessage(
            fdm,
            requester_id,
            message_id,
            `"test"<script>alert('xss')</script>`,
        )

        const message = await getMessage(fdm, requester_id, message_id)

        expect(message.body).toBe(
            "&quot;test&quot;&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
        )
    })

    test("should not allow a regular user to make a message internal", async ({
        fdm,
    }) => {
        const message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Original Message Body",
        )

        await expect(
            updateMessage(fdm, requester_id, message_id, undefined, true),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })

    test("should reject updates by unrelated users", async ({ fdm }) => {
        const message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Message Body",
        )

        await expect(
            updateMessage(
                fdm,
                other_user_id,
                message_id,
                "Hacked!!11!1!",
                false,
            ),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })

    test("should reject deletes by unrelated users", async ({ fdm }) => {
        const message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Message Body",
        )

        await expect(
            deleteMessage(fdm, other_user_id, message_id),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })
})

describe("Message Pagination", () => {
    let admin_id: string
    let requester_id: string
    let ticket_id: string
    let message_ids: string[]

    test.beforeAll(async ({ fdm }) => {
        // Create admin user
        admin_id = createId()

        await addAdminAgent(fdm, admin_id, "Support Agent")

        // Create requester user
        requester_id = createId()

        ticket_id = await createTicket(
            fdm,
            requester_id,
            `Seed message ${createId(8)}`,
        )

        const currentMessages = await fdm
            .update(schema.messages)
            .set({ created: new Date(2023, 0, 1) })
            .where(eq(schema.messages.ticket_id, ticket_id))
            .returning({ message_id: schema.messages.message_id })

        const messages: Promise<string>[] = [
            Promise.resolve(currentMessages[0].message_id),
        ]
        async function addOrderedMessage(
            fdm: FdmHelpdeskType,
            ticket_id: string,
            admin_id: string,
            sender_type: string,
            order: number,
        ) {
            const message_id = await addMessage(
                fdm,
                ticket_id,
                admin_id,
                "agent",
                `${sender_type} Message ${order}`,
            )

            const date = new Date(2023, 0, 1)
            date.setHours(order)

            await fdm
                .update(schema.messages)
                .set({ created: date })
                .where(eq(schema.messages.message_id, message_id))

            return message_id
        }
        for (let i = 1; i <= 99; i += 2) {
            messages.push(
                addOrderedMessage(fdm, ticket_id, admin_id, "agent", i),
            )
            messages.push(
                addOrderedMessage(
                    fdm,
                    ticket_id,
                    requester_id,
                    "customer",
                    i + 1,
                ),
            )
        }
        message_ids = await Promise.all(messages)
    })

    test("should not paginate when no custom pagination specified", async ({
        fdm,
    }) => {
        const messages = await getMessagesForTicket(
            fdm,
            requester_id,
            ticket_id,
        )

        expect(messages).toHaveLength(message_ids.length)
        expect(messages.map((message) => message.message_id)).toEqual(
            message_ids,
        )
    })

    test("should paginate with custom pagination", async ({ fdm }) => {
        const messages = await getMessagesForTicket(
            fdm,
            requester_id,
            ticket_id,
            { pageOffset: 11, pageLimit: 19 },
        )

        expect(messages).toHaveLength(19)
        expect(messages.map((message) => message.message_id)).toEqual(
            message_ids.slice(11, 11 + 19),
        )
    })

    test("should normalize bad pagination input", async ({ fdm }) => {
        const messages = await getMessagesForTicket(
            fdm,
            requester_id,
            ticket_id,
            { pageOffset: -2, pageLimit: 0 },
        )

        expect(messages).toHaveLength(1)
        expect(messages.map((message) => message.message_id)).toEqual(
            message_ids.slice(0, 1),
        )
    })
})

describe("Message Filters", () => {
    let admin_id: string
    let requester_id: string
    let ticket_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Support Agent")

        requester_id = createId()
        ticket_id = await createTicket(
            fdm,
            requester_id,
            `Ticket ${createId(8)}`,
        )
    })

    test("should filter messages by fromDate", async ({ fdm }) => {
        const early_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Early message",
        )
        const late_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Late message",
        )

        // Backdate the early message
        await fdm
            .update(schema.messages)
            .set({ created: new Date(2023, 0, 1) })
            .where(eq(schema.messages.message_id, early_id))

        const messages = await getMessagesForTicket(fdm, admin_id, ticket_id, {
            fromDate: new Date(2023, 0, 2),
            pageLimit: 100,
        })

        expect(messages.some((m) => m.message_id === early_id)).toBe(false)
        expect(messages.some((m) => m.message_id === late_id)).toBe(true)
    })

    test("should filter messages by toDate", async ({ fdm }) => {
        const early_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Early message",
        )
        const late_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Late message",
        )

        // Backdate the early message
        await fdm
            .update(schema.messages)
            .set({ created: new Date(2023, 0, 1) })
            .where(eq(schema.messages.message_id, early_id))

        const messages = await getMessagesForTicket(fdm, admin_id, ticket_id, {
            toDate: new Date(2023, 0, 2),
            pageLimit: 100,
        })

        expect(messages.some((m) => m.message_id === early_id)).toBe(true)
        expect(messages.some((m) => m.message_id === late_id)).toBe(false)
    })

    test("should filter messages by sentBy", async ({ fdm }) => {
        const requester_msg_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Customer message",
        )
        const agent_msg_id = await addMessage(
            fdm,
            ticket_id,
            admin_id,
            "agent",
            "Agent message",
        )

        const messages = await getMessagesForTicket(fdm, admin_id, ticket_id, {
            sentBy: [admin_id],
            pageLimit: 100,
        })

        expect(messages.some((m) => m.message_id === agent_msg_id)).toBe(true)
        expect(messages.some((m) => m.message_id === requester_msg_id)).toBe(
            false,
        )
    })
})
