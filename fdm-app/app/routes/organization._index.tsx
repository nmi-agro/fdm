import { NavLink, useLoaderData } from "react-router-dom"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import type { Route } from "./+types/organization._index"

// Meta
export const meta: Route.MetaFunction = () => {
    return [
        {
            title: `Organisaties | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk de organisaties waarvan je lid bent.",
        },
    ]
}

export async function loader({ request }: Route.LoaderArgs) {
    try {
        await getSession(request)

        const organizationsRaw = await auth.api.listOrganizations({
            headers: request.headers,
        })

        function parseMetadata(
            slug: string,
            rawMetadata: string | null | undefined,
        ) {
            try {
                return rawMetadata ? JSON.parse(rawMetadata) : {}
            } catch (e) {
                throw new Error(
                    `Failed to parse organization metadata for ${slug}`,
                    {
                        cause: e,
                    },
                )
            }
        }

        const organizations = organizationsRaw.map((org) => ({
            ...org,
            metadata: parseMetadata(org.slug, org.metadata),
        }))

        return { organizations }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function OrganizationsIndex() {
    const { organizations } = useLoaderData<typeof loader>()

    return (
        <main className="container">
            {/* Changed this div to a flex container with justify-between */}
            <div className="mb-8 flex items-center justify-between">
                <FarmTitle
                    title={"Mijn organisaties"}
                    description={
                        "Organisaties stellen je in staat om met anderen samen te werken. Je kunt organisaties aanmaken of lid worden om samen gegevens te beheren."
                    }
                    action={{
                        to: "/organization/new",
                        label: "Organisatie aanmaken",
                    }}
                />
            </div>
            <div className="px-4">
                {organizations.length === 0 ? (
                    <div className="mx-auto flex h-full w-full items-center flex-col justify-center space-y-6 sm:w-87.5">
                        <div className="flex flex-col space-y-2 text-center">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Je bent nog geen lid van een organisatie
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Vraag bij je contactpersoon om een uitnodiging
                                of maak zelf een organisatie aan.
                            </p>
                        </div>
                        <Button asChild>
                            <NavLink to="/organization/invitations">
                                Bekijk uitnodigingen
                            </NavLink>
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                        {organizations.map((org) => (
                            <NavLink
                                key={org.id}
                                to={`/organization/${org.slug}`}
                            >
                                <Card className="flex flex-col h-full">
                                    <CardHeader>
                                        <CardTitle>
                                            <div className="flex items-center justify-between">
                                                {org.name}
                                            </div>
                                        </CardTitle>
                                        <CardDescription />
                                    </CardHeader>
                                    <CardContent className="grow">
                                        <p className="text-sm text-muted-foreground truncate">
                                            {org.metadata?.description ??
                                                "Geen beschrijving"}
                                        </p>
                                    </CardContent>
                                    <CardFooter>
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                        >
                                            <div>Meer info</div>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </NavLink>
                        ))}
                    </div>
                )}
            </div>
        </main>
    )
}
