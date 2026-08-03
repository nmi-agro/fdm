import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, inject, it } from "vitest"
import type { FdmAuth } from "./authentication"
import type { FdmServerType } from "./fdm-server.types"
import { createFdmAuth } from "./authentication"
import * as authZSchema from "./db/schema-authz"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { createId } from "./id"
import {
  addFarmVerification,
  getActiveFarmVerifications,
  getFarmVerifications,
  getLatestFarmVerification,
  isFarmVerifiedForPrincipal,
  revokeFarmVerification,
} from "./verification"

describe("Farm Verification Functions", () => {
  let fdm: FdmServerType
  let fdmAuth: FdmAuth
  let principal_id: string
  let b_id_farm: string

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
      { clientId: "verification_google_id", clientSecret: "verification_google_secret" },
      {
        clientId: "verification_ms_id",
        tenantId: "common",
        privateKey: "verification_ms_key",
        certThumbprint: "verification_ms_thumbprint",
      },
      undefined,
      true,
    )

    const user = await fdmAuth.api.signUpEmail({
      headers: undefined,
      body: {
        email: `verification-${createId().toLowerCase()}@example.com`,
        name: "verification-user",
        username: `verification${createId().toLowerCase()}`,
        password: "password",
      } as any,
    })
    principal_id = user.user.id
    b_id_farm = await addFarm(fdm, principal_id, "Verification Farm", "555555", "Address", "1111AA")
  })

  it("records matching verification snapshots and links the audit entry", async () => {
    const verification_id = await addFarmVerification(fdm, principal_id, b_id_farm, {
      verification_method: "rvo_eherkenning",
      verification_result: "verified",
      b_businessid_farm: "555555",
    })

    const history = await getFarmVerifications(fdm, principal_id, b_id_farm)
    expect(history).toHaveLength(1)
    expect(history[0]).toEqual(
      expect.objectContaining({
        verification_id,
        b_id_farm,
        principal_id,
        b_businessid_farm: "555555",
        verification_method: "rvo_eherkenning",
        verification_result: "verified",
        revoked_at: null,
      }),
    )

    const verification = await fdm
      .select({ audit_id: authZSchema.farmVerification.audit_id })
      .from(authZSchema.farmVerification)
      .where(eq(authZSchema.farmVerification.verification_id, verification_id))
      .limit(1)
    expect(verification[0].audit_id).toBeTruthy()
    if (!verification[0].audit_id) {
      throw new Error("Expected the verification to reference an audit entry")
    }
    const audit = await fdm
      .select({ audit_id: authZSchema.audit.audit_id })
      .from(authZSchema.audit)
      .where(eq(authZSchema.audit.audit_id, verification[0].audit_id))
      .limit(1)
    expect(audit).toHaveLength(1)
    await expect(isFarmVerifiedForPrincipal(fdm, principal_id, b_id_farm)).resolves.toBe(true)
    await expect(getActiveFarmVerifications(fdm, principal_id, b_id_farm)).resolves.toEqual([
      expect.objectContaining({ verification_id, principal_id }),
    ])
    await expect(getLatestFarmVerification(fdm, principal_id, b_id_farm)).resolves.toEqual(
      expect.objectContaining({ verification_id, principal_id }),
    )
  })

  it("rejects a stale KvK snapshot", async () => {
    await expect(
      addFarmVerification(fdm, principal_id, b_id_farm, {
        verification_method: "rvo_eherkenning",
        verification_result: "verified",
        b_businessid_farm: "999999",
      }),
    ).rejects.toThrowError("Exception for addFarmVerification")
  })

  it("uses the latest negative result for a principal", async () => {
    await addFarmVerification(fdm, principal_id, b_id_farm, {
      verification_method: "rvo_eherkenning",
      verification_result: "not_verified",
      b_businessid_farm: "555555",
    })

    await expect(isFarmVerifiedForPrincipal(fdm, principal_id, b_id_farm)).resolves.toBe(false)
    await expect(getActiveFarmVerifications(fdm, principal_id, b_id_farm)).resolves.toEqual([])
    await expect(getLatestFarmVerification(fdm, principal_id, b_id_farm)).resolves.toEqual(
      expect.objectContaining({ verification_result: "not_verified" }),
    )
  })

  it("revokes softly while retaining history", async () => {
    const historyBeforeRevoke = await getFarmVerifications(fdm, principal_id, b_id_farm)
    const verification = historyBeforeRevoke.find(
      (entry) => entry.verification_result === "verified",
    )
    if (!verification) {
      throw new Error("Expected a positive verification measurement")
    }

    const verification_id = verification.verification_id
    await revokeFarmVerification(fdm, principal_id, b_id_farm, verification_id)

    await expect(isFarmVerifiedForPrincipal(fdm, principal_id, b_id_farm)).resolves.toBe(false)
    await expect(getActiveFarmVerifications(fdm, principal_id, b_id_farm)).resolves.toEqual([])
    await expect(getLatestFarmVerification(fdm, principal_id, b_id_farm)).resolves.toEqual(
      expect.objectContaining({ verification_result: "not_verified" }),
    )
    const history = await getFarmVerifications(fdm, principal_id, b_id_farm)
    expect(history).toHaveLength(2)
    expect(
      history.find((entry) => entry.verification_id === verification_id)?.revoked_at,
    ).toBeInstanceOf(Date)
  })

  it("does not expose verification status without farm access", async () => {
    await expect(isFarmVerifiedForPrincipal(fdm, createId(), b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })
})
