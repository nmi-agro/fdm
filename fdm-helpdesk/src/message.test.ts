import { describe, expect } from "vitest"
import { addAdminAgent } from "./agent"
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

    test.beforeEach(async ({ fdm, fdmAuth }) => {
        // Create admin user
        const admin_username = `testmessageadmin${createId(8)}`
        const admin = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${admin_username}@example.agency`,
                name: "Test Message Admin",
                username: admin_username,
                password: "password",
            },
        })
        admin_id = admin.user.id

        await addAdminAgent(fdm, admin_id, "Helpdesk Agent")

        // Create requester user
        const requester_username = `testmessagerequester${createId(8)}`
        const requester = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${requester_username}@example.client`,
                name: "Test Message Requester",
                username: requester_username,
                password: "password",
            },
        })
        requester_id = requester.user.id

        // Create another regular user
        const other_username = `testmessageother${createId(8)}`
        const other_user = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${other_username}@example.client`,
                name: "Test Message Other",
                username: other_username,
                password: "password",
            },
        })
        other_user_id = other_user.user.id

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

    test.beforeAll(async ({ fdm, fdmAuth }) => {
        // Create admin user
        const admin_username = `testmessageadmin${createId(8)}`
        const admin = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${admin_username}@example.agency`,
                name: "Test Message Admin",
                username: admin_username,
                password: "password",
            },
        })
        admin_id = admin.user.id

        await addAdminAgent(fdm, admin_id, "Support Agent")

        // Create requester user
        const requester_username = `testmessagerequester${createId(8)}`
        const requester = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${requester_username}@example.client`,
                name: "Test Message Requester",
                username: requester_username,
                password: "password",
            },
        })
        requester_id = requester.user.id

        ticket_id = await createTicket(
            fdm,
            requester_id,
            `Seed message ${createId(8)}`,
        )

        const messages: string[] = []
        for (let i = 1; i <= 50; i++) {
            messages.push(
                await addMessage(
                    fdm,
                    ticket_id,
                    admin_id,
                    "agent",
                    `Agent Message ${i}`,
                ),
            )
            messages.push(
                await addMessage(
                    fdm,
                    ticket_id,
                    requester_id,
                    "customer",
                    `Requester Message ${i}`,
                ),
            )
        }
        message_ids = messages
    })

    test("should paginate with no custom pagination specified", async ({
        fdm,
    }) => {
        const messages = await getMessagesForTicket(
            fdm,
            requester_id,
            ticket_id,
        )

        expect(messages).toHaveLength(20)
        expect(messages.map((message) => message.message_id)).toEqual(
            message_ids.slice(0, 20),
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
