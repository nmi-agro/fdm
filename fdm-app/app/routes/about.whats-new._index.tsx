import type { MetaFunction } from "react-router"
import { Changelog } from "~/components/blocks/changelog/changelog"
import { HeaderAbout } from "~/components/blocks/header/about"
import { Header } from "~/components/blocks/header/base"
import { changelogReleases } from "~/lib/changelog"
import { clientConfig } from "~/lib/config"

export const meta: MetaFunction = () => {
  return [
    { title: `Wat is er nieuw? | ${clientConfig.name}` },
    {
      name: "description",
      content: `Blijf op de hoogte van de laatste ontwikkelingen en verbeteringen van ${clientConfig.name}.`,
    },
  ]
}

/**
 * Renders the "Wat is er nieuw?" page: all releases of the application, newest first.
 *
 * Authentication is enforced by the parent `about` layout route.
 */
export default function WhatsNew() {
  return (
    <>
      <Header action={undefined}>
        <HeaderAbout />
      </Header>
      <Changelog title={`Wat is er nieuw in ${clientConfig.name}?`} releases={changelogReleases} />
    </>
  )
}
