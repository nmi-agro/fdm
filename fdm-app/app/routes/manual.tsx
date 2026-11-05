import { Outlet, useLoaderData } from "react-router"
import { ManualShell } from "~/components/blocks/manual/shell"
import { getManualNav } from "~/lib/manual/content.server"
import { getManualContext } from "~/lib/manual/context.server"
import { MANUAL_CACHE_CONTROL } from "~/lib/manual/seo"

/**
 * Layout of the public user manual. It is readable without signing in, so no route under
 * `/manual` reads the session.
 */
export function loader() {
  const { tokens } = getManualContext()
  return { sections: getManualNav(tokens) }
}

export function headers() {
  return { "Cache-Control": MANUAL_CACHE_CONTROL }
}

export default function ManualLayout() {
  const { sections } = useLoaderData<typeof loader>()
  return (
    <ManualShell sections={sections}>
      <Outlet />
    </ManualShell>
  )
}
