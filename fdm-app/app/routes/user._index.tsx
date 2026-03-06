import {
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderUser } from "~/components/blocks/header/user"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Account | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk en bewerk de gegevens van je account.",
        },
    ]
}

/**
 * Retrieves the user data.
 *
 * @param request - The HTTP request object used to retrieve session information.
 * @returns An object containing:
 *   - user: The user's information from the session data.
 *
 * @throws {Error} If retrieving the session fails.
 */
export async function loader({ request }: LoaderFunctionArgs) {
    try {
        // Get the session
        const session = await getSession(request)

        // Return user information from loader
        return {
            user: session.user,
            initials: session.initials,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the user interface for the user page.
 *
 * This component uses data from the loader to display the user's user details.
 */
export default function User() {
    const loaderData = useLoaderData<typeof loader>()
    const user = loaderData.user

    const avatarInitials = loaderData.initials

    return (
        <main className="container">
            <Header action={undefined}>
                <HeaderUser name={user.name} />
            </Header>
            <div className="max-w-3xl mx-auto px-4">
                <div className="mb-8">
                    <FarmTitle
                        title={"Accountgegevens"}
                        description={"Hier vind je jouw accountgegevens."}
                    />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Jouw gegevens</CardTitle>
                        <CardDescription>
                            Hieronder vind je jouw accountgegevens.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <Avatar className="h-12 w-12">
                                <AvatarImage
                                    src={user.image ?? undefined}
                                    alt={user.name}
                                />
                                <AvatarFallback>
                                    {avatarInitials}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {user.email}
                                </p>
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <p className="text-sm font-medium">
                                Voornaam:{" "}
                                <span className="font-normal text-muted-foreground">
                                    {user.firstname}
                                </span>
                            </p>
                            <p className="text-sm font-medium">
                                Achternaam:{" "}
                                <span className="font-normal text-muted-foreground">
                                    {user.surname}
                                </span>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
