import { beforeAll, describe, expect, inject, it } from "vitest"
import type { FdmServerType } from "./fdm-server.types"
import * as authNSchema from "./db/schema-authn"
import { createFdmServer } from "./fdm-server"
import { createId } from "./id"
import { listOrganizationRolesOfUser } from "./organization"

describe("listOrganizationRolesOfUser", () => {
  let fdm: FdmServerType

  const createUser = async () => {
    const id = createId()
    await fdm.insert(authNSchema.user).values({
      id,
      name: `user-${id}`,
      email: `${id.toLowerCase()}@example.com`,
    })
    return id
  }

  const createOrganization = async () => {
    const id = createId()
    await fdm.insert(authNSchema.organization).values({
      id,
      name: `Organization ${id}`,
      slug: `organization-${id.toLowerCase()}`,
      createdAt: new Date(),
    })
    return id
  }

  const addMember = async (organizationId: string, userId: string, role: string) => {
    await fdm.insert(authNSchema.member).values({
      id: createId(),
      organizationId,
      userId,
      role,
      createdAt: new Date(),
    })
  }

  beforeAll(() => {
    fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )
  })

  it("returns the roles of the user per organization", async () => {
    const user = await createUser()
    const colleague = await createUser()
    const orgA = await createOrganization()
    const orgB = await createOrganization()
    const orgOther = await createOrganization()
    await addMember(orgA, user, "owner")
    await addMember(orgA, colleague, "member")
    await addMember(orgB, user, "member")
    await addMember(orgOther, colleague, "admin")

    const roles = await listOrganizationRolesOfUser(fdm, user, user)

    expect(Object.fromEntries(roles)).toEqual({ [orgA]: ["owner"], [orgB]: ["member"] })
  })

  it("returns an empty map for a user without organizations", async () => {
    const user = await createUser()
    expect((await listOrganizationRolesOfUser(fdm, user, user)).size).toBe(0)
  })

  it("rejects a principal that reads the memberships of another user", async () => {
    const user = await createUser()
    const other = await createUser()
    const org = await createOrganization()
    await addMember(org, user, "owner")

    await expect(listOrganizationRolesOfUser(fdm, other, user)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })
})
