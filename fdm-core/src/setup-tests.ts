import { afterAll, vi } from "vitest"
import type { FdmServerType } from "./fdm-server.types"

// Test files call createFdmServer in beforeEach hooks. Without reuse, every call opens a new
// connection pool that is never closed, which exhausts the PostgreSQL connection limit on CI.
// Module state is isolated per test file, so every file shares one pool per distinct
// configuration, and all pools are closed when the file has finished.
const pools = new Map<string, FdmServerType>()

vi.mock("./fdm-server", async (importOriginal) => {
  const original = await importOriginal<typeof import("./fdm-server")>()

  return {
    ...original,
    createFdmServer: (...args: Parameters<typeof original.createFdmServer>) => {
      const [host, port, user, , database, max] = args
      const key = JSON.stringify([host, port, user, database, max])
      let fdm = pools.get(key)
      if (!fdm) {
        fdm = original.createFdmServer(...args)
        pools.set(key, fdm)
      }
      return fdm
    },
  }
})

afterAll(async () => {
  const open = [...pools.values()]
  pools.clear()
  await Promise.all(
    open.map((fdm) =>
      (fdm as unknown as { $client: { end: (o?: object) => Promise<void> } }).$client.end({
        timeout: 5,
      }),
    ),
  )
})
