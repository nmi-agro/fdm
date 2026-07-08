import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"

// Meta
export const meta: MetaFunction = () => {
  return [
    { title: `Profiel - Account | ${clientConfig.name}` },
    {
      name: "description",
      content: "Bekijk en bewerk de gegevens van je account.",
    },
  ]
}

/**
 * Retrieves the user's profile data from the session.
 *
 * @param request - The HTTP request used to retrieve session data.
 * @returns An object containing the user's details and avatar initials.
 *
 * @throws {Error} If session retrieval fails.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const session = await getSession(request)
    return {
      user: session.user,
      initials: session.initials,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Renders the user profile page.
 */
export default function UserSettingsProfile() {
  const { user, initials } = useLoaderData<typeof loader>()

  return (
    <>
      <FarmTitle title="Profiel" description="Jouw accountgegevens." />
      <div className="space-y-6 px-4 pb-8 md:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Jouw gegevens</CardTitle>
            <CardDescription>Hieronder vind je jouw accountgegevens.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-muted-foreground text-sm">{user.email}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Voornaam:{" "}
                <span className="text-muted-foreground font-normal">{user.firstname}</span>
              </p>
              <p className="text-sm font-medium">
                Achternaam:{" "}
                <span className="text-muted-foreground font-normal">{user.surname}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
