import { and, desc, eq, isNotNull, isNull } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmServerType } from "./fdm-server.types"
import { addAnimal } from "./animal"
import { type BetterAuth, createFdmAuth } from "./authentication"
import {
  actions,
  checkPermission,
  getRolesOfPrincipalForResource,
  grantRole,
  listPrincipalsForResource,
  listResources,
  resources,
  revokePrincipal,
  roles,
  updateRole,
} from "./authorization"
import { addBarn } from "./barn"
import * as schema from "./db/schema"
import * as authNSchema from "./db/schema-authn"
import * as authZSchema from "./db/schema-authz"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addFeedBatch, addFeedingAnimal, addFeedingHerd } from "./feed"
import { addHerd } from "./herd"
import { createId } from "./id"
import { addExcreting, addManureDisposing, addManurePit } from "./manure"
import { addMilkDelivery, addMilkingAnimal, addMilkingHerd, addMilkTank } from "./milk"

describe("Authorization Functions", () => {
  let fdm: FdmServerType
  let fdmAuth: BetterAuth
  let principal_id: string
  let farm_id: string
  let organization_id: string
  let organization_owner_id: string
  let organization_member_email: string
  let organization_member_id: string
  let host: string
  let port: number
  let user: string
  let password: string
  let database: string

  beforeAll(async () => {
    host = inject("host")
    port = inject("port")
    user = inject("user")
    password = inject("password")
    database = inject("database")
    // Mock environment variables
    const googleAuth = {
      clientId: "mock_google_client_id",
      clientSecret: "mock_google_client_secret",
    }
    const microsoftAuth = {
      clientId: "mock_ms_client_id",
      tenantId: "common",
      privateKey: "mock_ms_private_key",
      certThumbprint: "mock_ms_thumbprint",
    }

    fdm = createFdmServer(host, port, user, password, database, 10) // allow some connections
    fdmAuth = createFdmAuth(fdm, googleAuth, microsoftAuth, undefined, true)
    principal_id = createId()
  })

  beforeEach(async () => {
    farm_id = createId()
    // Create a test farm
    const farmName = "Test Farm"
    const farmBusinessId = "123456"
    const farmAddress = "123 Farm Lane"
    const farmPostalCode = "12345"
    await addFarm(fdm, farmName, farmBusinessId, farmAddress, farmPostalCode, principal_id)
    const organization_owner_username = `orgowner${createId(8).toLowerCase()}`
    const organization_owner: any = await fdmAuth.api.signUpEmail({
      headers: undefined,
      body: {
        email: `${organization_owner_username}@example.com`,
        name: "Organization Owner",
        firstname: "Organization",
        surname: "Owner",
        username: organization_owner_username,
        password: "password",
      } as any,
    })
    organization_owner_id = organization_owner.user.id

    organization_id = createId()
    await fdm.insert(authNSchema.organization).values({
      id: organization_id,
      name: "Test Organization",
      slug: `test-org-${createId(8).toLowerCase()}`,
      createdAt: new Date(),
      metadata: JSON.stringify({ description: "Test organization" }),
    })

    // Make the owner a member
    await fdm.insert(authNSchema.member).values({
      id: createId(),
      organizationId: organization_id,
      userId: organization_owner_id,
      role: "owner",
      createdAt: new Date(),
    })

    // Set up member details for tests
    organization_member_email = `member${createId(8).toLowerCase()}@example.com`
    const member_user: any = await fdmAuth.api.signUpEmail({
      headers: undefined,
      body: {
        email: organization_member_email,
        name: "Organization Member",
        firstname: "Organization",
        surname: "Member",
        username: `member${createId(8).toLowerCase()}`,
        password: "password",
      } as any,
    })
    organization_member_id = member_user.user.id

    // Manually add member to organization
    await fdm.insert(authNSchema.member).values({
      id: createId(),
      organizationId: organization_id,
      userId: organization_member_id,
      role: "member",
      createdAt: new Date(),
    })
  })

  describe("checkPermission", () => {
    it("should allow access if principal has the required role", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)
      await checkPermission(fdm, "farm", "read", farm_id, principal_id, "test")
    })

    it("should throw an error if principal does not have the required role", async () => {
      await expect(
        checkPermission(fdm, "farm", "read", farm_id, createId(), "test"),
      ).rejects.toThrowError("Principal does not have permission to perform this action")
    })

    it("should not throw an error in non-strict mode if principal does not have the required role", async () => {
      await expect(
        checkPermission(fdm, "farm", "read", farm_id, createId(), "test", false),
      ).resolves.toBe(false)
    })

    it("should grant access through the organization", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, organization_id)

      await checkPermission(fdm, "farm", "write", farm_id, organization_member_id, "test")
    })

    it("should not grant access through an organization not invited to a farm", async () => {
      await expect(
        checkPermission(fdm, "farm", "write", farm_id, organization_id, "test"),
      ).rejects.toThrow("Principal does not have permission to perform this action")
    })

    it("should not grant permissions higher than the organization permissions", async () => {
      await grantRole(fdm, "farm", "researcher", farm_id, organization_id)

      await expect(
        checkPermission(fdm, "farm", "write", farm_id, organization_member_id, "test"),
      ).rejects.toThrow("Principal does not have permission to perform this action")
    })

    it("should throw an error for unknown resource", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)
      await expect(
        checkPermission(fdm, "unknown_resource" as any, "read", farm_id, principal_id, "test"),
      ).rejects.toThrowError("Exception for checkPermission")
    })

    it("should resolve resource chains for barn, herd, and animal resources, including not-found cases", async () => {
      const real_farm_id = await addFarm(
        fdm,
        principal_id,
        "Livestock Test Farm",
        "123456",
        "Farm Lane 1",
        "1234AB",
      )

      const b_id_barn = await addBarn(fdm, principal_id, real_farm_id)
      await checkPermission(fdm, "barn", "read", b_id_barn, principal_id, "test")

      const l_id_herd = await addHerd(fdm, principal_id, real_farm_id)
      await checkPermission(fdm, "herd", "read", l_id_herd, principal_id, "test")

      const l_id_animal = await addAnimal(fdm, principal_id, real_farm_id, l_id_herd)
      await checkPermission(fdm, "animal", "read", l_id_animal, principal_id, "test")

      await expect(
        checkPermission(fdm, "barn", "read", "non_existent_barn", principal_id, "test"),
      ).rejects.toThrowError("Principal does not have permission to perform this action")

      await expect(
        checkPermission(fdm, "herd", "read", "non_existent_herd", principal_id, "test"),
      ).rejects.toThrowError("Principal does not have permission to perform this action")

      await expect(
        checkPermission(fdm, "animal", "read", "non_existent_animal", principal_id, "test"),
      ).rejects.toThrowError("Principal does not have permission to perform this action")
    })

    it("should resolve the milk resource chain via tank, herd milking, delivery, and animal milking records", async () => {
      const real_farm_id = await addFarm(
        fdm,
        principal_id,
        "Milk Test Farm",
        "123456",
        "Farm Lane 1",
        "1234AB",
      )

      // Branch 1: resource_id matches a milk tank directly
      const l_id_milktank = await addMilkTank(fdm, principal_id, real_farm_id)
      await checkPermission(fdm, "milk", "read", l_id_milktank, principal_id, "test")

      // Branch 2: resource_id matches a herd-level milking record (l_id_herd)
      const l_id_herd = await addHerd(fdm, principal_id, real_farm_id)
      await addMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, new Date())
      await checkPermission(fdm, "milk", "read", l_id_herd, principal_id, "test")

      // Branch 3: resource_id matches a milk delivering record (l_id_milkdelivery)
      await addMilkDelivery(fdm, principal_id, l_id_milktank, new Date(), 100)
      const [delivering] = await fdm
        .select({ l_id_milkdelivery: schema.milkDelivering.l_id_milkdelivery })
        .from(schema.milkDelivering)
        .where(eq(schema.milkDelivering.l_id_milktank, l_id_milktank))
        .limit(1)
      await checkPermission(fdm, "milk", "read", delivering.l_id_milkdelivery, principal_id, "test")

      // Branch 4: resource_id matches an animal-level milking record (l_id_animal)
      const l_id_animal = await addAnimal(fdm, principal_id, real_farm_id, l_id_herd)
      await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, new Date())
      await checkPermission(fdm, "milk", "read", l_id_animal, principal_id, "test")

      // No branch matches: chain is empty, permission denied
      await expect(
        checkPermission(fdm, "milk", "read", "non_existent_milk_resource", principal_id, "test"),
      ).rejects.toThrowError("Principal does not have permission to perform this action")
    })

    it("should resolve the feed resource chain via batch, herd feeding, and animal feeding records", async () => {
      const real_farm_id = await addFarm(
        fdm,
        principal_id,
        "Feed Test Farm",
        "123456",
        "Farm Lane 1",
        "1234AB",
      )

      // Branch 1: resource_id matches a feed batch directly
      const f_id_batch = await addFeedBatch(
        fdm,
        principal_id,
        real_farm_id,
        "gras_kuil",
        "own_land",
      )
      await checkPermission(fdm, "feed", "read", f_id_batch, principal_id, "test")

      // Branch 2: resource_id matches a herd feeding record (l_id_herd)
      const l_id_herd = await addHerd(fdm, principal_id, real_farm_id)
      await addFeedingHerd(fdm, principal_id, f_id_batch, l_id_herd, new Date())
      await checkPermission(fdm, "feed", "read", l_id_herd, principal_id, "test")

      // Branch 3: resource_id matches an animal feeding record (l_id_animal)
      const l_id_animal = await addAnimal(fdm, principal_id, real_farm_id, l_id_herd)
      await addFeedingAnimal(fdm, principal_id, f_id_batch, l_id_animal, new Date())
      await checkPermission(fdm, "feed", "read", l_id_animal, principal_id, "test")

      // No branch matches: chain is empty, permission denied
      await expect(
        checkPermission(fdm, "feed", "read", "non_existent_feed_resource", principal_id, "test"),
      ).rejects.toThrowError("Principal does not have permission to perform this action")
    })

    it("should resolve the manure resource chain via pit, excreting, and disposing records", async () => {
      const real_farm_id = await addFarm(
        fdm,
        principal_id,
        "Manure Test Farm",
        "123456",
        "Farm Lane 1",
        "1234AB",
      )

      // Branch 1: resource_id matches a manure pit directly
      const b_id_manurepit = await addManurePit(fdm, principal_id, real_farm_id)
      await checkPermission(fdm, "manure", "read", b_id_manurepit, principal_id, "test")

      // Branch 2: resource_id matches an excreting record (l_id_excreting)
      const l_id_herd = await addHerd(fdm, principal_id, real_farm_id)
      const l_id_excreting = await addExcreting(fdm, principal_id, l_id_herd, b_id_manurepit)
      await checkPermission(fdm, "manure", "read", l_id_excreting, principal_id, "test")

      // Branch 3: resource_id matches a manure disposing record (p_id_disposing)
      await addManureDisposing(fdm, principal_id, b_id_manurepit, new Date(), 1000)
      const [disposing] = await fdm
        .select({ p_id_disposing: schema.manureDisposing.p_id_delivery })
        .from(schema.manureDisposing)
        .where(eq(schema.manureDisposing.b_id_manurepit, b_id_manurepit))
        .limit(1)
      await checkPermission(fdm, "manure", "read", disposing.p_id_disposing, principal_id, "test")

      // No branch matches: chain is empty, permission denied
      await expect(
        checkPermission(
          fdm,
          "manure",
          "read",
          "non_existent_manure_resource",
          principal_id,
          "test",
        ),
      ).rejects.toThrowError("Principal does not have permission to perform this action")
    })

    it("should store the audit log when a permission check is performed and allowed", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)
      await checkPermission(fdm, "farm", "read", farm_id, principal_id, "test")

      const auditLogs = await fdm
        .select()
        .from(authZSchema.audit)
        .where(eq(authZSchema.audit.principal_id, principal_id))
        .orderBy(desc(authZSchema.audit.audit_timestamp))
      expect(auditLogs.length).toBeGreaterThanOrEqual(1)
      expect(auditLogs[0].target_resource).toBe("farm")
      expect(auditLogs[0].target_resource_id).toBe(farm_id)
      expect(auditLogs[0].action).toBe("read")
      expect(auditLogs[0].allowed).toBe(true)
    })

    it("should store the audit log when a permission check is performed and not allowed", async () => {
      const principal_id_new = createId()

      await expect(
        checkPermission(fdm, "farm", "read", farm_id, principal_id_new, "test"),
      ).rejects.toThrowError("Principal does not have permission to perform this action")

      const auditLogs = await fdm
        .select()
        .from(authZSchema.audit)
        .where(eq(authZSchema.audit.principal_id, principal_id_new))
        .orderBy(desc(authZSchema.audit.audit_timestamp))
      expect(auditLogs.length).toBeGreaterThanOrEqual(1)
      expect(auditLogs[0].target_resource).toBe("farm")
      expect(auditLogs[0].target_resource_id).toBe(farm_id)
      expect(auditLogs[0].action).toBe("read")
      expect(auditLogs[0].allowed).toBe(false)
    })

    it("should not store the audit log if non-strict", async () => {
      const principal_id_new = createId()

      await expect(
        checkPermission(fdm, "farm", "read", farm_id, principal_id_new, "test", false),
      ).resolves.toBe(false)

      const auditLogs = await fdm
        .select()
        .from(authZSchema.audit)
        .where(eq(authZSchema.audit.principal_id, principal_id_new))
        .orderBy(desc(authZSchema.audit.audit_timestamp))
      expect(auditLogs).toHaveLength(0)
    })
  })

  describe("grantRole", () => {
    it("should grant a role to a principal for a resource", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)

      const roles = await fdm
        .select()
        .from(authZSchema.role)
        .where(
          and(
            eq(authZSchema.role.resource, "farm"),
            eq(authZSchema.role.resource_id, farm_id),
            eq(authZSchema.role.principal_id, principal_id),
            eq(authZSchema.role.role, "owner"),
            isNull(authZSchema.role.deleted),
          ),
        )
      expect(roles.length).toBe(1)
    })

    it("should throw an error for invalid resource", async () => {
      await expect(
        grantRole(fdm, "unknown_resource" as any, "owner", farm_id, principal_id),
      ).rejects.toThrowError()
    })

    it("should throw an error for invalid role", async () => {
      await expect(
        grantRole(fdm, "farm", "unknown_role" as any, farm_id, principal_id),
      ).rejects.toThrowError()
    })

    it("should throw an error for invalid principal_id", async () => {
      await expect(grantRole(fdm, "farm", "owner", farm_id, null as any)).rejects.toThrowError()
    })

    it("should throw an error if the principal already has a non-deleted role", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)

      await expect(grantRole(fdm, "farm", "advisor", farm_id, principal_id)).rejects.toThrowError(
        "Exception for grantRole",
      )
    })
  })

  describe("revokePrincipal", () => {
    it("should revoke a role from a principal for a resource", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)
      await revokePrincipal(fdm, "farm", farm_id, principal_id)

      const roles = await fdm
        .select()
        .from(authZSchema.role)
        .where(
          and(
            eq(authZSchema.role.resource, "farm"),
            eq(authZSchema.role.resource_id, farm_id),
            eq(authZSchema.role.principal_id, principal_id),
            eq(authZSchema.role.role, "owner"),
            isNotNull(authZSchema.role.deleted),
          ),
        )
      expect(roles.length).toBe(1)
    })

    it("should not throw an error when revoking a non-existing role", async () => {
      await revokePrincipal(fdm, "farm", farm_id, principal_id)
      const roles = await fdm
        .select()
        .from(authZSchema.role)
        .where(
          and(
            eq(authZSchema.role.resource, "farm"),
            eq(authZSchema.role.resource_id, farm_id),
            eq(authZSchema.role.principal_id, principal_id),
            eq(authZSchema.role.role, "owner"),
            isNotNull(authZSchema.role.deleted),
          ),
        )
      expect(roles.length).toBe(0)
    })

    it("should throw an error for invalid resource", async () => {
      await expect(
        revokePrincipal(fdm, "unknown_resource" as any, farm_id, principal_id),
      ).rejects.toThrowError()
    })
  })

  describe("updateRole", () => {
    it("should update the role of a principal for a resource", async () => {
      // Grant initial role
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)

      // Update the role
      await updateRole(fdm, "farm", "advisor", farm_id, principal_id)

      // Verify the new role
      const newRole = await fdm
        .select()
        .from(authZSchema.role)
        .where(
          and(
            eq(authZSchema.role.resource, "farm"),
            eq(authZSchema.role.resource_id, farm_id),
            eq(authZSchema.role.principal_id, principal_id),
            eq(authZSchema.role.role, "advisor"),
            isNull(authZSchema.role.deleted),
          ),
        )
      expect(newRole.length).toBe(1)

      // Verify the old role is revoked
      const oldRole = await fdm
        .select()
        .from(authZSchema.role)
        .where(
          and(
            eq(authZSchema.role.resource, "farm"),
            eq(authZSchema.role.resource_id, farm_id),
            eq(authZSchema.role.principal_id, principal_id),
            eq(authZSchema.role.role, "owner"),
          ),
        )
      expect(oldRole.length).toBe(1)
      expect(oldRole[0].deleted).not.toBeNull()
    })

    it("should throw an error for invalid resource", async () => {
      await expect(
        updateRole(fdm, "unknown_resource" as any, "advisor", farm_id, principal_id),
      ).rejects.toThrowError("Exception for updateRole")
    })

    it("should throw an error for invalid role", async () => {
      await expect(
        updateRole(fdm, "farm", "unknown_role" as any, farm_id, principal_id),
      ).rejects.toThrowError("Exception for updateRole")
    })

    it("should throw an error if the database transaction fails", async () => {
      // Mock the transaction function to throw an error
      const mockTx = async (_txCallback: unknown) => {
        throw new Error("Database transaction failed")
      }
      const fdmMock = {
        ...fdm,
        transaction: mockTx,
      } as unknown as typeof fdm
      // Act & Assert
      await expect(
        updateRole(fdmMock, "farm", "advisor", farm_id, principal_id),
      ).rejects.toThrowError("Exception for updateRole")
    })

    it("should handle case when no old role to revoke", async () => {
      // Update the role
      await updateRole(fdm, "farm", "advisor", farm_id, principal_id)

      // Verify the new role
      const newRole = await fdm
        .select()
        .from(authZSchema.role)
        .where(
          and(
            eq(authZSchema.role.resource, "farm"),
            eq(authZSchema.role.resource_id, farm_id),
            eq(authZSchema.role.principal_id, principal_id),
            eq(authZSchema.role.role, "advisor"),
            isNull(authZSchema.role.deleted),
          ),
        )
      expect(newRole.length).toBe(1)

      // Verify no old role is revoked
      const oldRole = await fdm
        .select()
        .from(authZSchema.role)
        .where(
          and(
            eq(authZSchema.role.resource, "farm"),
            eq(authZSchema.role.resource_id, farm_id),
            eq(authZSchema.role.principal_id, principal_id),
            eq(authZSchema.role.role, "owner"),
          ),
        )
      expect(oldRole.length).toBe(0)
    })
    it("should handle updating the role to a non existing role", async () => {
      // Grant initial role
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)

      // Update the role
      await updateRole(fdm, "farm", "researcher", farm_id, principal_id)

      // Verify the new role
      const newRole = await fdm
        .select()
        .from(authZSchema.role)
        .where(
          and(
            eq(authZSchema.role.resource, "farm"),
            eq(authZSchema.role.resource_id, farm_id),
            eq(authZSchema.role.principal_id, principal_id),
            eq(authZSchema.role.role, "researcher"),
            isNull(authZSchema.role.deleted),
          ),
        )
      expect(newRole.length).toBe(1)

      // Verify the old role is revoked
      const oldRole = await fdm
        .select()
        .from(authZSchema.role)
        .where(
          and(
            eq(authZSchema.role.resource, "farm"),
            eq(authZSchema.role.resource_id, farm_id),
            eq(authZSchema.role.principal_id, principal_id),
            eq(authZSchema.role.role, "owner"),
          ),
        )
      expect(oldRole.length).toBe(1)
      expect(oldRole[0].deleted).not.toBeNull()
    })
  })

  describe("listResources", () => {
    it("should list resources a principal has access to", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)

      const accessibleResources = await listResources(fdm, "farm", "read", principal_id)
      expect(accessibleResources).toContain(farm_id)
    })

    it("should handle multiple roles", async () => {
      const principal_id_new = createId()
      const farm_id2 = createId()
      await grantRole(fdm, "farm", "owner", farm_id, principal_id_new)
      await grantRole(fdm, "farm", "advisor", farm_id2, principal_id_new)

      const accessibleResources = await listResources(fdm, "farm", "read", principal_id_new)
      expect(accessibleResources.length).toBe(2)
      expect(accessibleResources).toContain(farm_id)
      expect(accessibleResources).toContain(farm_id2)
    })

    it("should list resources that the user's organization has access to", async () => {
      const farm_id2 = createId()
      await grantRole(fdm, "farm", "owner", farm_id, organization_id)
      await grantRole(fdm, "farm", "advisor", farm_id2, organization_id)

      const accessibleResources = await listResources(fdm, "farm", "read", organization_member_id)
      expect(accessibleResources.length).toBe(2)
      expect(accessibleResources).toContain(farm_id)
      expect(accessibleResources).toContain(farm_id2)
    })

    it("should not list duplicates", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, organization_member_id)
      await grantRole(fdm, "farm", "advisor", farm_id, organization_id)

      const accessibleResources = await listResources(fdm, "farm", "read", organization_member_id)
      expect(accessibleResources).toEqual([farm_id])
    })

    it("should handle empty list", async () => {
      const principal_id_new = createId()
      const accessibleResources = await listResources(fdm, "farm", "read", principal_id_new)
      expect(accessibleResources.length).toBe(0)
    })
    it("should handle invalid resource", async () => {
      await expect(
        listResources(fdm, "unknown_resource" as any, "read", principal_id),
      ).rejects.toThrowError()
    })
    it("should handle invalid action", async () => {
      await expect(
        listResources(fdm, "farm", "unknown_action" as any, principal_id),
      ).rejects.toThrowError()
    })
  })

  describe("getRolesOfPrincipalForResource", () => {
    it("should get direct roles", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)

      const roles = await getRolesOfPrincipalForResource(fdm, "farm", farm_id, principal_id)
      expect(roles).toEqual([
        {
          principal_id: principal_id,
          role: "owner",
          principal_type: "user",
        },
      ])
    })

    // it("should get inherited roles", async () => {
    //     const field_id = await addField(
    //         fdm,
    //         principal_id,
    //         farm_id,
    //         "Test Field",
    //         "test source",
    //         {
    //             type: "Polygon",
    //             coordinates: [
    //                 [
    //                     [30, 10],
    //                     [40, 40],
    //                     [20, 40],
    //                     [10, 20],
    //                     [30, 10],
    //                 ],
    //             ],
    //         },
    //         new Date("2023-01-01"),
    //         "owner",
    //         new Date("2024-01-01"),
    //     )
    //     await grantRole(fdm, "farm", "owner", farm_id, principal_id)
    //     await grantRole(fdm, "field", "advisor", field_id, principal_id)

    //     const roles = await getRolesOfPrincipalForResource(
    //         fdm,
    //         "field",
    //         field_id,
    //         principal_id,
    //     )
    //     expect(roles).toEqual(["advisor", "owner"])
    // })

    // it("should get direct roles without inherited roles", async () => {
    //     const field_id = await addField(
    //         fdm,
    //         principal_id,
    //         farm_id,
    //         "Test Field",
    //         "test source",
    //         {
    //             type: "Polygon",
    //             coordinates: [
    //                 [
    //                     [30, 10],
    //                     [40, 40],
    //                     [20, 40],
    //                     [10, 20],
    //                     [30, 10],
    //                 ],
    //             ],
    //         },
    //         new Date("2023-01-01"),
    //         "owner",
    //         new Date("2024-01-01"),
    //     )

    //     await grantRole(fdm, "farm", "advisor", farm_id, principal_id)
    //     await grantRole(fdm, "field", "advisor", field_id, principal_id)

    //     const roles = await getRolesOfPrincipalForResource(
    //         fdm,
    //         "field",
    //         field_id,
    //         principal_id,
    //     )
    //     expect(roles).toEqual(["advisor"])
    // })

    it("should return an empty array if the principal has no roles for the resource", async () => {
      const other_principal_id = createId()

      const roles = await getRolesOfPrincipalForResource(fdm, "farm", farm_id, other_principal_id)
      expect(roles).toEqual([])
    })

    it("should get roles derived from an organization", async () => {
      await grantRole(fdm, "farm", "researcher", farm_id, organization_id)

      const roles = await getRolesOfPrincipalForResource(
        fdm,
        "farm",
        farm_id,
        organization_member_id,
      )
      expect(roles).toEqual([
        {
          principal_id: organization_id,
          principal_type: "organization",
          role: "researcher",
        },
      ])
    })

    it("should get all roles", async () => {
      await grantRole(fdm, "farm", "researcher", farm_id, organization_member_id)
      await grantRole(fdm, "farm", "owner", farm_id, organization_id)

      const roles = await getRolesOfPrincipalForResource(
        fdm,
        "farm",
        farm_id,
        organization_member_id,
      )
      expect(roles.length).toBe(2)
      expect(roles).toContainEqual({
        principal_id: organization_id,
        principal_type: "organization",
        role: "owner",
      })
      expect(roles).toContainEqual({
        principal_id: organization_member_id,
        principal_type: "user",
        role: "researcher",
      })
    })

    it("should get organization's roles as organization roles", async () => {
      await grantRole(fdm, "farm", "researcher", farm_id, organization_id)

      const roles = await getRolesOfPrincipalForResource(fdm, "farm", farm_id, organization_id)
      expect(roles).toEqual([
        {
          principal_id: organization_id,
          principal_type: "organization",
          role: "researcher",
        },
      ])
    })

    it("should get role principal type properly for organization with no members", async () => {
      // Create an organization without any members
      const orgId = createId()
      await fdm.insert(authNSchema.organization).values({
        id: orgId,
        name: "Test Organization No Members",
        slug: `test-org-no-member-${createId(8).toLowerCase()}`,
        createdAt: new Date(),
      })

      // Grant the organization a role on the farm
      await grantRole(fdm, "farm", "advisor", farm_id, orgId)

      // Get roles for the organization
      const roles = await getRolesOfPrincipalForResource(fdm, "farm", farm_id, orgId)

      // Should return one role with principal_type "organization"
      expect(roles).toHaveLength(1)
      expect(roles[0]).toEqual({
        principal_id: orgId,
        role: "advisor",
        principal_type: "organization",
      })
    })

    it("should throw error with invalid resource", async () => {
      await expect(
        getRolesOfPrincipalForResource(fdm, "unknown_resource" as any, farm_id, principal_id),
      ).rejects.toThrowError("Exception for getRolesOfPrincipalForResource")
    })

    it("should throw an error if the database transaction fails", async () => {
      // Mock the transaction function to throw an error
      const mockTx = async (_txCallback: unknown) => {
        throw new Error("Database transaction failed")
      }
      const fdmMock = {
        ...fdm,
        transaction: mockTx,
      } as unknown as typeof fdm
      // Act & Assert
      await expect(
        getRolesOfPrincipalForResource(fdmMock, "farm", farm_id, principal_id),
      ).rejects.toThrowError("Exception for getRolesOfPrincipalForResource")
    })
  })

  describe("listPrincipalsForResource", () => {
    let principal_id2: string

    beforeEach(async () => {
      principal_id2 = createId()
    })

    it("should list principals associated with a resource", async () => {
      // Grant roles to two principals
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)
      await grantRole(fdm, "farm", "advisor", farm_id, principal_id2)

      const principals = await listPrincipalsForResource(fdm, "farm", farm_id)

      expect(principals.length).toBe(2)
      expect(principals).toContainEqual({
        principal_id: principal_id,
        role: "owner",
      })
      expect(principals).toContainEqual({
        principal_id: principal_id2,
        role: "advisor",
      })
    })

    it("should return an empty array if no principals are associated with the resource", async () => {
      const principals = await listPrincipalsForResource(fdm, "farm", farm_id)
      expect(principals).toEqual([])
    })

    it("should throw an error for an invalid resource type", async () => {
      await expect(
        listPrincipalsForResource(fdm, "invalid_resource" as any, farm_id),
      ).rejects.toThrowError("Exception for listPrincipalsForResource")
    })

    it("should handle revoked principals correctly", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)
      await revokePrincipal(fdm, "farm", farm_id, principal_id)

      const principals = await listPrincipalsForResource(fdm, "farm", farm_id)
      expect(principals).toEqual([])
    })

    it("should not list revoked roles", async () => {
      // Grant and then revoke the role
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)
      await revokePrincipal(fdm, "farm", farm_id, principal_id)

      // Now check if the role is present in the list
      const result = await listPrincipalsForResource(fdm, "farm", farm_id)
      expect(result.length).toBe(0)
    })

    it("should throw an error if the database transaction fails", async () => {
      // Mock the transaction function to throw an error
      const mockTx = async (_txCallback: unknown) => {
        throw new Error("Database transaction failed")
      }
      const fdmMock = {
        ...fdm,
        transaction: mockTx,
      } as unknown as typeof fdm
      // Act & Assert
      await expect(listPrincipalsForResource(fdmMock, "farm", farm_id)).rejects.toThrowError(
        "Exception for listPrincipalsForResource",
      )
    })

    it("should handle different resources", async () => {
      for (const resource of resources) {
        if (resource === "user" || resource === "organization") continue // these resources are not added by the code
        const testResourceId = createId()
        await grantRole(fdm, resource, "owner", testResourceId, principal_id)
        const principals = await listPrincipalsForResource(fdm, resource, testResourceId)

        expect(principals.length).toBe(1)
        expect(principals).toContainEqual({
          principal_id: principal_id,
          role: "owner",
        })
      }
    })

    it("should have the correct properties on the result object", async () => {
      await grantRole(fdm, "farm", "owner", farm_id, principal_id)
      const result = await listPrincipalsForResource(fdm, "farm", farm_id)

      expect(result.length).toBe(1)
      expect(result[0]).toHaveProperty("principal_id")
      expect(result[0]).toHaveProperty("role")
      expect(typeof result[0].principal_id).toBe("string")
      expect(typeof result[0].role).toBe("string")
    })
  })
  describe("Authorization Constants", () => {
    it("should have the correct resources", () => {
      expect(resources).toEqual([
        "user",
        "organization",
        "farm",
        "field",
        "cultivation",
        "fertilizer_application",
        "soil_analysis",
        "soil_image",
        "harvesting",
        "barn",
        "herd",
        "animal",
        "milk",
        "feed",
        "manure",
      ])
    })

    it("should have the correct roles", () => {
      expect(roles).toEqual(["owner", "advisor", "researcher"])
    })

    it("should have the correct actions", () => {
      expect(actions).toEqual(["read", "write", "list", "share"])
    })
  })
})
