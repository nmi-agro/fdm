import { data, useLoaderData } from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { OrganizationSettingsForm } from "~/components/blocks/organization/form"
import { FormSchema } from "~/components/blocks/organization/schema"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { extractFormValuesFromRequest } from "~/lib/form"
import { parseOrganizationMetadata } from "~/lib/organization-helpers"
import type { Route } from "./+types/organization.$slug.settings"

// Meta
export const meta: Route.MetaFunction = () => {
    return [
        {
            title: `Instellingen - Organisatie | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk en bewerk de gegevens van jouw organisatie.",
        },
    ]
}

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
            throw data("Organisatie niet gevonden.", {
                status: 404,
                statusText: "Organisatie niet gevonden.",
            })
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

        const organization = {
            ...organizationRaw,
            metadata: parseOrganizationMetadata(organizationRaw),
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
        <main>
            <FarmTitle
                title={"Organisatie instellingen"}
                description={"Werk de gegevens bij van deze organisatie."}
                action={{ to: "./..", label: "Terug naar dashboard" }}
            />
            <OrganizationSettingsForm
                organization={loaderData.organization}
                canModify={loaderData.organizationEditPermission}
            />
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
            throw data("Organisatie niet gevonden.", {
                status: 404,
                statusText: "Organisatie niet gevonden.",
            })
        }

        const name = formValues.name
        const slug = formValues.slug
        const description = formValues.description || ""

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

        return redirectWithSuccess(`/organization/${slug}`, {
            message: `Organisatie ${formValues.name} is succesvol bijgewerkt! 🎉`,
        })
    } catch (error) {
        if (
            error &&
            (error as { body?: { code?: string } }).body?.code ===
                "ORGANIZATION_SLUG_ALREADY_TAKEN"
        ) {
            return dataWithError(
                null,
                "Naam voor organisatie is niet meer beschikbaar. Kies een andere naam",
            )
        }

        throw handleActionError(error)
    }
}
