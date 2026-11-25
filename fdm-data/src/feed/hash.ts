import type { CatalogueFeedItem } from "./d"
import { ensureInitialized, h32ToString } from "../hash"

export async function hashFeed(feed: CatalogueFeedItem) {
  await ensureInitialized()
  feed.hash = null

  const filteredFeed = Object.fromEntries(
    Object.entries(feed).filter(([, value]) => value !== undefined && value !== null),
  )
  const sortedKeys = Object.keys(filteredFeed).sort()
  const sortedFeed = sortedKeys.reduce<Record<string, unknown>>((obj, key) => {
    obj[key] = feed[key as keyof typeof feed]
    return obj
  }, {})

  return h32ToString(JSON.stringify(sortedFeed))
}
