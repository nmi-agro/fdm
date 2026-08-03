import {
  getActiveFarmVerifications,
  getPrincipals,
  listPrincipalsForFarm,
  type FdmType,
} from "@nmi-agro/fdm-core"

export interface FarmVerificationProvider {
  principal_id: string
  display_name: string
  verified_at: Date
}

export async function getFarmVerificationStatus(
  fdm: FdmType,
  principal_id: string,
  b_id_farm: string,
) {
  const [activeVerifications, farmPrincipals] = await Promise.all([
    getActiveFarmVerifications(fdm, principal_id, b_id_farm),
    listPrincipalsForFarm(fdm, principal_id, b_id_farm),
  ])
  const accessiblePrincipalIds = new Set(
    farmPrincipals
      .filter((principal) => principal.status === "active")
      .map((principal) => principal.id),
  )
  const currentVerifications = activeVerifications.filter((verification) =>
    accessiblePrincipalIds.has(verification.principal_id),
  )

  const principalIds = [
    ...new Set(currentVerifications.map((verification) => verification.principal_id)),
  ]
  const principals = await getPrincipals(fdm, principalIds)
  const latestByPrincipal = new Map<string, FarmVerificationProvider>()

  for (const verification of currentVerifications) {
    if (latestByPrincipal.has(verification.principal_id)) continue
    const principal = principals.get(verification.principal_id)
    latestByPrincipal.set(verification.principal_id, {
      principal_id: verification.principal_id,
      display_name: principal?.displayUserName || principal?.username || verification.principal_id,
      verified_at: verification.verified_at,
    })
  }

  return {
    isVerified: currentVerifications.length > 0,
    latest: currentVerifications[0]
      ? latestByPrincipal.get(currentVerifications[0].principal_id)
      : undefined,
    providers: [...latestByPrincipal.values()],
  }
}
