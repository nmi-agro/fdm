import type { CatalogueAnimalCategory } from "./d"
import { ensureInitialized, h32ToString } from "../hash"

export async function hashAnimalCategory(
  category: CatalogueAnimalCategory & { hash?: string | null },
) {
  await ensureInitialized()

  const { hash: _hash, ...copy } = category
  const sortedKeys = Object.keys(copy).sort()
  const sortedCategory = sortedKeys.reduce<Record<string, unknown>>((item, key) => {
    item[key] = copy[key as keyof typeof copy]
    return item
  }, {})

  return h32ToString(JSON.stringify(sortedCategory))
}
