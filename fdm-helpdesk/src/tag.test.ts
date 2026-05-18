import { sql } from "drizzle-orm"
import { describe, expect } from "vitest"
import { addAdminAgent, addAgent } from "./agent"
import { createId } from "./id"
import {
    addTagToTicket,
    createTag,
    getTag,
    removeTagFromTicket,
    updateTag,
} from "./tag"
import { test } from "./test-util"
import { createTicket, getTicket } from "./ticket"

describe("Tag CRUD", () => {
    let admin_id: string

    test.beforeEach(async ({ fdm, fdmAuth }) => {
        // Create agent_id
        const admin_username = `testtagadmin${createId(8)}`
        const admin = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${admin_username}@example.agency`,
                name: "Test Tag Admin",
                username: admin_username,
                password: "password",
            },
        })
        admin_id = admin.user.id

        await addAdminAgent(fdm, admin_id, "Support Agent")
    })

    test("should create tags", async ({ fdm }) => {
        const nameSuffix = createId(8)
        const tag_id = await createTag(
            fdm,
            admin_id,
            `Red${nameSuffix}`,
            "#ff0000",
            "This is a red tag.",
        )

        const tag = await getTag(fdm, tag_id)

        expect(tag.name).toBe(`Red${nameSuffix}`)
        expect(tag.name_lower).toBe(`Red${nameSuffix}`.toLowerCase())
        expect(tag.color).toBe("#ff0000")
        expect(tag.description).toBe("This is a red tag.")
    })

    test("should not let tags with empty name", async ({ fdm }) => {
        try {
            await createTag(
                fdm,
                admin_id,
                "",
                "#ff2222",
                "This is a very mysterious tag.",
            )
            expect(true, "Should have thrown").toBe(false)
        } catch (err) {
            expect(err.cause).toBeDefined()
            expect(err.cause.message).toBe("Tag name cannot be empty")
        }
    })

    test("should prevent name collision when creating a tag", async ({
        fdm,
    }) => {
        const nameSuffix = createId(8)
        await createTag(
            fdm,
            admin_id,
            `Red${nameSuffix}`,
            "#ff0000",
            "This is a red tag.",
        )

        try {
            await createTag(
                fdm,
                admin_id,
                `red${nameSuffix}`,
                "#ff2222",
                "This is a red tag but less intense.",
            )
            expect(true, "Should have thrown").toBe(false)
        } catch (err) {
            expect(err.cause).toBeDefined()
            expect(err.cause.message).toBe(
                "Another tag with name already exists",
            )
        }
    })

    test("should update tags", async ({ fdm }) => {
        const nameSuffix = createId(8)
        const tag_id = await createTag(
            fdm,
            admin_id,
            `Red${nameSuffix}`,
            "#ff0000",
            "This is a red tag.",
        )

        await updateTag(
            fdm,
            admin_id,
            tag_id,
            undefined,
            "#ff0022",
            "This is a reddish tag.",
        )

        const tag = await getTag(fdm, tag_id)

        expect(tag.name).toBe(`Red${nameSuffix}`)
        expect(tag.name_lower).toBe(`Red${nameSuffix}`.toLowerCase())
        expect(tag.color).toBe("#ff0022")
        expect(tag.description).toBe("This is a reddish tag.")
    })

    test("should change the letter case of a tag without detecting a name collision", async ({
        fdm,
    }) => {
        const nameSuffix = createId(8)
        const tag_id = await createTag(
            fdm,
            admin_id,
            `Red${nameSuffix}`,
            "#ff0000",
            "This is a red tag.",
        )

        await updateTag(fdm, admin_id, tag_id, `red${nameSuffix}`)

        const tag = await getTag(fdm, tag_id)

        expect(tag.name).toBe(`red${nameSuffix}`)
        expect(tag.name_lower).toBe(`red${nameSuffix}`.toLowerCase())
        expect(tag.color).toBe("#ff0000")
        expect(tag.description).toBe("This is a red tag.")
    })
})

describe("Ticket Tags", () => {
    let admin_id: string
    let requester_id: string
    let ticket_id: string
    let blue_tag_id: string

    test.beforeEach(async ({ fdm, fdmAuth }) => {
        // Create agent_id
        const admin_username = `testtickettagadmin${createId(8)}`
        const admin = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${admin_username}@example.agency`,
                name: "Test Ticket-Tag Admin",
                username: admin_username,
                password: "password",
            },
        })
        admin_id = admin.user.id

        await addAdminAgent(fdm, admin_id, "Support Agent")

        // Create agent_id
        const requester_username = `testtickettagreq${createId(8)}`
        const requester = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${requester_username}@example.client`,
                name: "Test Ticket-Tag Requester",
                username: requester_username,
                password: "password",
            },
        })
        requester_id = requester.user.id

        ticket_id = await createTicket(
            fdm,
            requester_id,
            "This is a ticket with tags.",
        )

        blue_tag_id = await createTag(
            fdm,
            admin_id,
            `Blue${createId(8)}`,
            "#0000ff",
            "This is a blue tag.",
        )
    })

    test("should throw an error if the target ticket doesn't exist", async ({
        fdm,
    }) => {
        const failError = new Error("Should have thrown")
        try {
            await addTagToTicket(fdm, admin_id, "bad-ticket-id", blue_tag_id)
            throw failError
        } catch (err) {
            if (err === failError) throw err
            expect(err.cause).toBeDefined()
            expect(err.cause.message).toBe(
                "Principal does not have permission to perform this action",
            )
        }
    })

    test("should add a tag to a ticket", async ({ fdm }) => {
        await addTagToTicket(fdm, admin_id, ticket_id, blue_tag_id)

        const ticket = await getTicket(fdm, admin_id, ticket_id)

        expect(ticket.tags.some((tag) => tag.tag_id === blue_tag_id)).toBe(true)
    })

    test("should do nothing while adding a tag to a ticket that it already has", async ({
        fdm,
    }) => {
        await addTagToTicket(fdm, admin_id, ticket_id, blue_tag_id)
        await addTagToTicket(fdm, admin_id, ticket_id, blue_tag_id)

        const ticket = await getTicket(fdm, admin_id, ticket_id)

        expect(ticket.tags.some((tag) => tag.tag_id === blue_tag_id)).toBe(true)
    })

    test("should remove a tag to a ticket", async ({ fdm }) => {
        await addTagToTicket(fdm, admin_id, ticket_id, blue_tag_id)
        await removeTagFromTicket(fdm, admin_id, ticket_id, blue_tag_id)

        const ticket = await getTicket(fdm, admin_id, ticket_id)

        expect(ticket.tags.some((tag) => tag.tag_id === blue_tag_id)).toBe(
            false,
        )
    })

    test("should do nothing while removing a tag from a ticket that doesn't have it", async ({
        fdm,
    }) => {
        await removeTagFromTicket(fdm, admin_id, ticket_id, blue_tag_id)

        const ticket = await getTicket(fdm, admin_id, ticket_id)

        expect(ticket.tags.some((tag) => tag.tag_id === blue_tag_id)).toBe(
            false,
        )
    })

    test("should not let regular users change tags", async ({ fdm }) => {
        const failError = new Error("Should have thrown")
        try {
            await addTagToTicket(fdm, requester_id, ticket_id, blue_tag_id)
            throw failError
        } catch (err) {
            if (err === failError) throw err
            expect(err.cause).toBeDefined()
            expect(err.cause.message).toBe(
                "Principal does not have permission to perform this action",
            )

            const ticket = await getTicket(fdm, admin_id, ticket_id)

            expect(ticket.tags.some((tag) => tag.tag_id === blue_tag_id)).toBe(
                false,
            )
        }
    })
})
