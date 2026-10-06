import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, inject, it } from "vitest"
import type { FdmAuth } from "./authentication"
import type { FdmServerType } from "./fdm-server.types"
import { createFdmAuth } from "./authentication"
import { grantRole } from "./authorization"
import * as schema from "./db/schema"
import * as authNSchema from "./db/schema-authn"
import { addFarm, removeFarm } from "./farm"
import {
  addFarmToGroup,
  createFarmGroup,
  getFarmGroup,
  listFarmGroups,
  removeFarmFromGroup,
  removeFarmGroup,
  renameFarmGroup,
} from "./farm-group"
import { createFdmServer } from "./fdm-server"
import { createId } from "./id"

const DENIED = "Principal does not have permission to perform this action"

/** handleError wraps the original error as `cause`; assert on its message. */
const expectCause = async (promise: Promise<unknown>, text: string) => {
  const error = await promise.then(
    () => undefined,
    (e: Error) => e,
  )
  expect(error).toBeDefined()
  expect((error?.cause as Error | undefined)?.message).toContain(text)
}

describe("Farm group functions", () => {
  let fdm: FdmServerType
  let fdmAuth: FdmAuth
  let member_id: string
  let outsider_id: string
  let b_id_organization: string
  let b_id_farm_a: string
  let b_id_farm_b: string
  let b_id_farm_other: string

  const createUser = async (name: string) => {
    const result = await fdmAuth.api.signUpEmail({
      headers: undefined,
      body: {
        email: `${name}@example.com`,
        name,
        username: name,
        password: "password",
      } as any,
    })
    return result.user.id
  }

  beforeAll(async () => {
    fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )
    fdmAuth = createFdmAuth(
      fdm,
      { clientId: "mock_google_client_id", clientSecret: "mock_google_client_secret" },
      {
        clientId: "mock_ms_client_id",
        tenantId: "common",
        privateKey: "mock_ms_private_key",
        certThumbprint: "mock_ms_thumbprint",
      },
      undefined,
      true,
    )

    member_id = await createUser("farmgroupmember")
    outsider_id = await createUser("farmgroupoutsider")

    b_id_organization = createId()
    await fdm.insert(authNSchema.organization).values({
      id: b_id_organization,
      name: "Farm Group Org",
      slug: `farm-group-org-${b_id_organization.toLowerCase()}`,
      createdAt: new Date(),
    })
    await fdm.insert(authNSchema.member).values({
      id: createId(),
      organizationId: b_id_organization,
      userId: member_id,
      role: "owner",
      createdAt: new Date(),
    })

    // Two farms of the organization, one farm that is not
    b_id_farm_a = await addFarm(fdm, member_id, "Farm A", null, null, null)
    b_id_farm_b = await addFarm(fdm, member_id, "Farm B", null, null, null)
    b_id_farm_other = await addFarm(fdm, member_id, "Farm other", null, null, null)
    await grantRole(fdm, "farm", "owner", b_id_farm_a, b_id_organization)
    await grantRole(fdm, "farm", "owner", b_id_farm_b, b_id_organization)
  })

  describe("createFarmGroup", () => {
    it("should create a group and trim the name", async () => {
      const b_id_group = await createFarmGroup(fdm, member_id, b_id_organization, "  Project A ")
      const group = await getFarmGroup(fdm, member_id, b_id_group)
      expect(group.b_name_group).toBe("Project A")
      expect(group.b_id_organization).toBe(b_id_organization)
      expect(group.b_id_farms).toEqual([])
    })

    it("should reject principals that are not a member of the organization", async () => {
      await expect(createFarmGroup(fdm, outsider_id, b_id_organization, "Nope")).rejects.toThrow(
        DENIED,
      )
    })

    it("should reject empty names and duplicate names in the same organization", async () => {
      await expectCause(
        createFarmGroup(fdm, member_id, b_id_organization, "   "),
        "Name of the farm group is required",
      )
      await createFarmGroup(fdm, member_id, b_id_organization, "Duplicate")
      await expectCause(
        createFarmGroup(fdm, member_id, b_id_organization, "duplicate"),
        "already exists",
      )
    })
  })

  describe("getFarmGroup / listFarmGroups", () => {
    it("should deny access to principals without a role on the group", async () => {
      const b_id_group = await createFarmGroup(fdm, member_id, b_id_organization, "Private")
      await expect(getFarmGroup(fdm, outsider_id, b_id_group)).rejects.toThrow(DENIED)
      await expect(getFarmGroup(fdm, member_id, createId())).rejects.toThrow()
    })

    it("should list groups of an organization ordered by name", async () => {
      const orgId = createId()
      await fdm.insert(authNSchema.organization).values({
        id: orgId,
        name: "List Org",
        slug: `list-org-${orgId.toLowerCase()}`,
        createdAt: new Date(),
      })
      await fdm.insert(authNSchema.member).values({
        id: createId(),
        organizationId: orgId,
        userId: member_id,
        role: "owner",
        createdAt: new Date(),
      })
      expect(await listFarmGroups(fdm, member_id, orgId)).toEqual([])

      await createFarmGroup(fdm, member_id, orgId, "Melkvee")
      await createFarmGroup(fdm, member_id, orgId, "Akkerbouw")
      const groups = await listFarmGroups(fdm, member_id, orgId)
      expect(groups.map((g) => g.b_name_group)).toEqual(["Akkerbouw", "Melkvee"])
      await expect(listFarmGroups(fdm, outsider_id, orgId)).rejects.toThrow(DENIED)
    })
  })

  describe("renameFarmGroup", () => {
    it("should rename a group and reject names that are in use", async () => {
      const b_id_group = await createFarmGroup(fdm, member_id, b_id_organization, "Old name")
      await createFarmGroup(fdm, member_id, b_id_organization, "Taken name")
      await renameFarmGroup(fdm, member_id, b_id_group, "New name")
      expect((await getFarmGroup(fdm, member_id, b_id_group)).b_name_group).toBe("New name")

      await expectCause(renameFarmGroup(fdm, member_id, b_id_group, "taken name"), "already exists")
      await expect(renameFarmGroup(fdm, outsider_id, b_id_group, "Hacked")).rejects.toThrow(DENIED)
    })
  })

  describe("membership", () => {
    it("should add a farm to multiple groups and derive membership", async () => {
      const group1 = await createFarmGroup(fdm, member_id, b_id_organization, "Member group 1")
      const group2 = await createFarmGroup(fdm, member_id, b_id_organization, "Member group 2")

      await addFarmToGroup(fdm, member_id, group1, b_id_farm_a)
      await addFarmToGroup(fdm, member_id, group2, b_id_farm_a)
      await addFarmToGroup(fdm, member_id, group1, b_id_farm_b)
      // Adding an active member again is a no-op
      await addFarmToGroup(fdm, member_id, group1, b_id_farm_a)

      expect((await getFarmGroup(fdm, member_id, group1)).b_id_farms.sort()).toEqual(
        [b_id_farm_a, b_id_farm_b].sort(),
      )
      expect((await getFarmGroup(fdm, member_id, group2)).b_id_farms).toEqual([b_id_farm_a])
    })

    it("should record a leaving event instead of deleting the joining", async () => {
      const b_id_group = await createFarmGroup(fdm, member_id, b_id_organization, "Leaving group")
      await addFarmToGroup(fdm, member_id, b_id_group, b_id_farm_a)
      await removeFarmFromGroup(fdm, member_id, b_id_group, b_id_farm_a)
      // Removing a non-member is a no-op
      await removeFarmFromGroup(fdm, member_id, b_id_group, b_id_farm_a)

      expect((await getFarmGroup(fdm, member_id, b_id_group)).b_id_farms).toEqual([])
      const joinings = await fdm
        .select()
        .from(schema.farmGroupJoining)
        .where(eq(schema.farmGroupJoining.b_id_group, b_id_group))
      const leavings = await fdm
        .select()
        .from(schema.farmGroupLeaving)
        .where(eq(schema.farmGroupLeaving.b_id_group, b_id_group))
      expect(joinings).toHaveLength(1)
      expect(leavings).toHaveLength(1)
    })

    it("should allow a farm to rejoin after leaving, repeatedly", async () => {
      const b_id_group = await createFarmGroup(fdm, member_id, b_id_organization, "Rejoin group")
      for (let i = 0; i < 3; i++) {
        await addFarmToGroup(fdm, member_id, b_id_group, b_id_farm_b)
        expect((await getFarmGroup(fdm, member_id, b_id_group)).b_id_farms).toEqual([b_id_farm_b])
        await removeFarmFromGroup(fdm, member_id, b_id_group, b_id_farm_b)
        expect((await getFarmGroup(fdm, member_id, b_id_group)).b_id_farms).toEqual([])
      }
      await addFarmToGroup(fdm, member_id, b_id_group, b_id_farm_b)
      expect((await getFarmGroup(fdm, member_id, b_id_group)).b_id_farms).toEqual([b_id_farm_b])
    })

    it("should reject farms that do not belong to the organization", async () => {
      const b_id_group = await createFarmGroup(fdm, member_id, b_id_organization, "Foreign group")
      await expectCause(
        addFarmToGroup(fdm, member_id, b_id_group, b_id_farm_other),
        "does not belong to the organization",
      )
    })

    it("should reject principals without permission", async () => {
      const b_id_group = await createFarmGroup(fdm, member_id, b_id_organization, "Guarded group")
      await expect(addFarmToGroup(fdm, outsider_id, b_id_group, b_id_farm_a)).rejects.toThrow(
        DENIED,
      )
      await expect(removeFarmFromGroup(fdm, outsider_id, b_id_group, b_id_farm_a)).rejects.toThrow(
        DENIED,
      )
    })
  })

  describe("removal", () => {
    it("should remove a group with its membership events", async () => {
      const b_id_group = await createFarmGroup(fdm, member_id, b_id_organization, "Doomed group")
      await addFarmToGroup(fdm, member_id, b_id_group, b_id_farm_a)
      await removeFarmFromGroup(fdm, member_id, b_id_group, b_id_farm_a)
      await addFarmToGroup(fdm, member_id, b_id_group, b_id_farm_a)

      await expect(removeFarmGroup(fdm, outsider_id, b_id_group)).rejects.toThrow(DENIED)
      await removeFarmGroup(fdm, member_id, b_id_group)

      await expect(getFarmGroup(fdm, member_id, b_id_group)).rejects.toThrow()
      const groups = await listFarmGroups(fdm, member_id, b_id_organization)
      expect(groups.find((g) => g.b_id_group === b_id_group)).toBeUndefined()
      const joinings = await fdm
        .select()
        .from(schema.farmGroupJoining)
        .where(eq(schema.farmGroupJoining.b_id_group, b_id_group))
      expect(joinings).toHaveLength(0)
    })

    it("should drop group memberships when a farm is removed", async () => {
      const b_id_farm = await addFarm(fdm, member_id, "Temporary farm", null, null, null)
      await grantRole(fdm, "farm", "owner", b_id_farm, b_id_organization)
      const b_id_group = await createFarmGroup(fdm, member_id, b_id_organization, "Farm removal")
      await addFarmToGroup(fdm, member_id, b_id_group, b_id_farm)

      await removeFarm(fdm, member_id, b_id_farm)

      expect((await getFarmGroup(fdm, member_id, b_id_group)).b_id_farms).toEqual([])
    })
  })
})
