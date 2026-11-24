/**
 * The farm list (`farm._index`) reads the user's roles and the farm groups of all the user's
 * organizations at once, instead of once per organization, with the same result.
 *
 * Better Auth reads the organizations of the user from the session cookie, which these tests do
 * not have, so `listOrganizations` and `listUserInvitations` are replaced by spies that answer
 * for the signed-in user.
 */
import { createFarmGroup, listFarmGroups } from "@nmi-agro/fdm-core"
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { auth } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"
import { loader } from "~/routes/farm._index"
import { seedOrganization } from "../../e2e/seed/organization"
import { loaderArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

type Organization = Awaited<ReturnType<typeof auth.api.listOrganizations>>[number]

let owner: SeededUser
let colleague: SeededUser
/** Organizations that the owner is a member of, as `listOrganizations` returns them. */
let organizations: Organization[]
let ownOrganization: string
let colleagueOrganization: string

/** A slug that no other test or earlier run uses. */
const uniqueSlug = (label: string) => `${label}-${randomUUID().slice(0, 8)}`

const organization = (id: string, slug: string): Organization => ({
  id,
  name: slug,
  slug,
  logo: null,
  metadata: null,
  createdAt: new Date(),
})

beforeAll(async () => {
  owner = await seedUserWithFarm("farmlist")
  colleague = await seedUserWithFarm("colleague")

  // An organization of the owner, with a group that holds the owner's farm and a second group
  const ownSlug = uniqueSlug("eigen-bureau")
  const own = await seedOrganization(
    fdm as unknown as Parameters<typeof seedOrganization>[0],
    owner.user.id,
    owner.ids.farm,
    owner.ids.year,
    { name: ownSlug, slug: ownSlug },
  )
  ownOrganization = own.id
  await createFarmGroup(fdm, owner.user.id, ownOrganization, "Akkerbouw")

  // An organization of a colleague, in which the owner is a member, with two groups
  const colleagueSlug = uniqueSlug("collega-bureau")
  const colleagueOrg = await seedOrganization(
    fdm as unknown as Parameters<typeof seedOrganization>[0],
    colleague.user.id,
    colleague.ids.farm,
    colleague.ids.year,
    { name: colleagueSlug, slug: colleagueSlug },
  )
  colleagueOrganization = colleagueOrg.id
  await createFarmGroup(fdm, colleague.user.id, colleagueOrganization, "Melkvee")
  await auth.api.addMember({
    body: { userId: owner.user.id, organizationId: colleagueOrganization, role: "member" },
  })

  // An organization of the colleague alone, which the owner must not see
  const otherSlug = uniqueSlug("ander-bureau")
  await seedOrganization(
    fdm as unknown as Parameters<typeof seedOrganization>[0],
    colleague.user.id,
    colleague.ids.farm,
    colleague.ids.year,
    { name: otherSlug, slug: otherSlug },
  )

  organizations = [
    organization(ownOrganization, ownSlug),
    organization(colleagueOrganization, colleagueSlug),
  ]
  vi.spyOn(auth.api, "listOrganizations").mockImplementation(async () => organizations)
  vi.spyOn(auth.api, "listUserInvitations").mockImplementation(async () => [])
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe("farm list", () => {
  it("shows the user's roles and the farm groups of every organization", async () => {
    const listMembers = vi.spyOn(auth.api, "listMembers")
    signInAs(owner.user)

    const { status, data } = await runRoute(() => loader(loaderArgs("/farm", {})))
    expect(status).toBe(200)
    expect(listMembers).not.toHaveBeenCalled()

    const result = data as {
      organizations: { id: string; userRoles: string[] }[]
      farmGroups: {
        b_id_group: string
        b_name_group: string
        b_id_organization: string
        b_id_farms: string[]
      }[]
      farms: { b_id_farm: string; organization?: { id: string } }[]
    }

    expect(result.organizations.map((org) => [org.id, org.userRoles])).toEqual([
      [ownOrganization, ["owner"]],
      [colleagueOrganization, ["member"]],
    ])

    // The same groups, in the same order, as reading them per organization
    const expectedGroups = []
    for (const org of organizations) {
      for (const group of await listFarmGroups(fdm, owner.user.id, org.id)) {
        expectedGroups.push({
          b_id_group: group.b_id_group,
          b_name_group: group.b_name_group,
          b_id_organization: org.id,
          b_id_farms: group.b_id_farms,
        })
      }
    }
    expect(result.farmGroups).toEqual(expectedGroups)
    expect(result.farmGroups.map((group) => group.b_name_group)).toEqual([
      "Akkerbouw",
      "Demo groep",
      "Demo groep",
      "Melkvee",
    ])
    expect(
      result.farmGroups.find(
        (group) => group.b_id_organization === ownOrganization && group.b_id_farms.length > 0,
      )?.b_id_farms,
    ).toEqual([owner.ids.farm])

    // The farm shows the organization that has access to it
    expect(result.farms.find((farm) => farm.b_id_farm === owner.ids.farm)?.organization?.id).toBe(
      ownOrganization,
    )
  })

  it("shows no organizations and groups for a user without organizations", async () => {
    const loner = await seedUserWithFarm("loner")
    vi.mocked(auth.api.listOrganizations).mockImplementationOnce(async () => [])
    signInAs(loner.user)

    const { status, data } = await runRoute(() => loader(loaderArgs("/farm", {})))
    expect(status).toBe(200)
    expect(data).toMatchObject({ organizations: [], farmGroups: [] })
  })
})
