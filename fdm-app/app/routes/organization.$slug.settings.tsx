import { data, useLoaderData } from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { OrganizationSettingsForm } from "~/components/blocks/organization/form"
import { FormSchema } from "~/components/blocks/organization/schema"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { auth, getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/organization.$slug.settings"

export async function loader({ params, request }: Route.LoaderArgs) {
    try {
        const session = await getSession(request)

        const organizations = await auth.api.listOrganizations({
            headers: request.headers,
        })

        const organizationRaw = organizations.find(
            (org) => org.slug === params.slug,
        )

        if (!organizationRaw) {
            throw data("Organisatie niet gevonden.", 404)
        }

        const members = (
            await auth.api.listMembers({
                headers: request.headers,
                query: {
                    organizationId: organizationRaw.id,
                },
            })
        ).members

        // Determine permissions
        const currentUserMember = members.find(
            (m) => m.userId === session.principal_id,
        )
        const role = currentUserMember?.role ?? "viewer"
        const organizationEditPermission = role === "owner" || role === "admin"

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

        const organization = {
            ...organizationRaw,
            metadata: parseMetadata(
                organizationRaw.slug,
                organizationRaw.metadata,
            ),
        }

        return {
            organization: organization,
            organizationEditPermission: organizationEditPermission,
        }
    } catch (e) {
        throw handleLoaderError(e)
    }
}

/**
 * Renders a form for updating organization properties.
 *
 * This component initializes a form using data loaded from the route loader and sets default values for fields such as organization name (required), slug, and description. It leverages validation with a Zod schema and automatically resets form data when the loader data changes. Upon submission, the form sends a POST request to update the organization settings.
 */
export default function OrganizationSettingsBlock() {
    const loaderData = useLoaderData<typeof loader>()
    return (
        <main className="container">
            <div className="max-w-3xl mx-auto px-4 space-y-8">
                <FarmTitle
                    title={"Organisatie instellingen"}
                    description={"Werk de gegevens bij van dit organisatie."}
                    action={{ to: "./..", label: "Terug naar dashboard" }}
                />
                <Card>
                    <CardHeader>
                        <CardTitle>Organisatiegegevens</CardTitle>
                        <CardDescription>
                            Voer de gegevens van je organisatie in.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <OrganizationSettingsForm
                            organization={loaderData.organization}
                            canModify={loaderData.organizationEditPermission}
                        />
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}

export async function action({ params, request }: Route.ActionArgs) {
    try {
        // Get the session
        await getSession(request)

        // Get the form values
        const formValues = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )
        const currentOrganization = (
            await auth.api.listOrganizations({ headers: request.headers })
        ).find((org) => org.slug === params.slug)

        if (!currentOrganization) {
            throw data("Organisatie niet gevonden.", 404)
        }

        const name = formValues.name
        const slug = formValues.slug
        const description = formValues.description || ""

        // Check if slug is available
        if (currentOrganization.slug !== slug) {
            try {
                await auth.api.checkOrganizationSlug({
                    headers: request.headers,
                    body: {
                        slug: slug,
                    },
                })
            } catch (e) {
                if (
                    e &&
                    (e as { body?: { code?: string } }).body?.code ===
                        "SLUG_IS_TAKEN"
                ) {
                    return dataWithError(
                        null,
                        "Naam voor organisatie is niet meer beschikbaar. Kies een andere naam",
                    )
                }

                throw e
            }
        }

        // Update the organization
        await auth.api.updateOrganization({
            headers: request.headers,
            body: {
                organizationId: currentOrganization.id,
                data: {
                    name,
                    slug,
                    metadata: {
                        description,
                    },
                },
            },
        })

        return redirectWithSuccess(`/organization/${formValues.slug}`, {
            message: `Organisatie ${formValues.name} is succesvol bijgewerkt! 🎉`,
        })
    } catch (error) {
        throw handleActionError(error)
    }
}
