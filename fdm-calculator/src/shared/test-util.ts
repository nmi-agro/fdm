import { FdmType, getLatestCachedResultForEntity } from "@nmi-agro/fdm-core"

export const createId = () => (Math.random() * 0xefffffff + 0x10000000).toString(16)

export async function pollLatestCachedResultForEntity(
  fdm: FdmType,
  calculationFunctionName: string,
  entityType: string,
  entityId: string,
) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const entry = await getLatestCachedResultForEntity(
      fdm,
      calculationFunctionName,
      entityType,
      entityId,
    )
    if (entry) {
      return entry
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error("Timed out.")
}
