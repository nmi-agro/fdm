import { describe, expect } from "vitest"
import { addAdminAgent, addAgent } from "./agent"
import { createId } from "./id"
import {
    addTagToTicket,
    createTag,
    deleteTag,
    getTag,
    getTags,
    getTagsForTickets,
    removeTagFromTicket,
    updateTag,
} from "./tag"
import { test } from "./test-util"
import { createTicket, getTicket } from "./ticket"

describe("Tag CRUD", () => {
    let admin_id: string

    test.beforeEach(async ({ fdm }) => {
        // Create agent_id
        admin_id = createId()

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

    test("should throw when getting a tag that does not exist", async ({
        fdm,
    }) => {
        await expect(getTag(fdm, "nonexistent-tag-id")).rejects.toThrow()
    })

    test("should not let tags with empty name", async ({ fdm }) => {
        const failError = new Error("Should have thrown")
        try {
            await createTag(
                fdm,
                admin_id,
                "",
                "#ff2222",
                "This is a very mysterious tag.",
            )
            throw failError
        } catch (err) {
            if (err === failError) throw err
            const error = err as Error
            expect(error.cause).toBeDefined()
            expect((error.cause as Error).message).toBe(
                "Tag name cannot be empty",
            )
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

        const failError = new Error("Should have thrown")
        try {
            await createTag(
                fdm,
                admin_id,
                `red${nameSuffix}`,
                "#ff2222",
                "This is a red tag but less intense.",
            )
            throw failError
        } catch (err) {
            if (err === failError) throw err
            const error = err as Error
            expect(error.cause).toBeDefined()
            expect((error.cause as Error).message).toBe(
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

    test.beforeEach(async ({ fdm }) => {
        // Create agent_id
        admin_id = createId()

        await addAdminAgent(fdm, admin_id, "Support Agent")

        // Create agent_id
        requester_id = createId()

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
            const error = err as Error
            expect(error.cause).toBeDefined()
            expect((error.cause as Error).message).toBe(
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
            const error = err as Error
            expect(error.cause).toBeDefined()
            expect((error.cause as Error).message).toBe(
                "Principal does not have permission to perform this action",
            )

            const ticket = await getTicket(fdm, admin_id, ticket_id)

            expect(ticket.tags.some((tag) => tag.tag_id === blue_tag_id)).toBe(
                false,
            )
        }
    })

    test("should remove tag from all tickets then delete it", async ({
        fdm,
    }) => {
        const tag_to_delete_id = await createTag(
            fdm,
            admin_id,
            `Purple${createId(8)}`,
            "#aa00ff",
        )
        await addTagToTicket(fdm, admin_id, ticket_id, tag_to_delete_id)
        await deleteTag(fdm, admin_id, tag_to_delete_id)

        const ticketTags =
            (await getTagsForTickets(fdm, admin_id, [ticket_id])).get(
                ticket_id,
            ) ?? []
        expect(ticketTags.some((tag) => tag.tag_id === tag_to_delete_id)).toBe(
            false,
        )
    })
})

describe("getTags", () => {
    let admin_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Support Agent")
    })

    test("should return all tags", async ({ fdm }) => {
        const nameSuffix = createId(8)
        const tag_id_1 = await createTag(
            fdm,
            admin_id,
            `Alpha${nameSuffix}`,
            "#aaaaaa",
        )
        const tag_id_2 = await createTag(
            fdm,
            admin_id,
            `Beta${nameSuffix}`,
            "#bbbbbb",
        )

        const tags = await getTags(fdm)

        expect(tags.some((t) => t.tag_id === tag_id_1)).toBe(true)
        expect(tags.some((t) => t.tag_id === tag_id_2)).toBe(true)
    })
})

describe("Tag authorization and edge cases", () => {
    let admin_id: string
    let user_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Support Agent")
        user_id = createId()
    })

    test("should let regular agents read tags for their tickets", async ({
        fdm,
    }) => {
        const regular_agent_id = createId()
        await addAgent(fdm, admin_id, regular_agent_id, "Regular Agent")

        const requester_id = createId()
        const ticket_id = await createTicket(fdm, requester_id, "Tagged Ticket")

        const tag_id = await createTag(
            fdm,
            admin_id,
            `AgentTag${createId(8)}`,
            "#aabbcc",
        )
        const tag_id_2 = await createTag(
            fdm,
            admin_id,
            `AgentTag${createId(8)}`,
            "#ddeeff",
        )
        // Create another tag to see if it is excluded properly
        await createTag(fdm, admin_id, `AgentTag${createId(8)}`, "#ddeeff")
        await addTagToTicket(fdm, admin_id, ticket_id, tag_id)
        await addTagToTicket(fdm, admin_id, ticket_id, tag_id_2)

        const tagsMap = await getTagsForTickets(fdm, regular_agent_id, [
            ticket_id,
        ])
        const tags = tagsMap.get(ticket_id)
        expect(tags).toBeDefined()
        expect(tags).toHaveLength(2)
        expect(tags?.some((t) => t.tag_id === tag_id)).toBe(true)
        expect(tags?.some((t) => t.tag_id === tag_id_2)).toBe(true)
    })

    test("regular user cannot create a tag", async ({ fdm }) => {
        await expect(
            createTag(fdm, user_id, `UserTag${createId(8)}`, "#123456"),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })

    test("updateTag throws when tag does not exist", async ({ fdm }) => {
        await expect(
            updateTag(fdm, admin_id, "nonexistent-tag-id", "New Name"),
        ).rejects.toThrow()
    })
})
