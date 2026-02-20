import {
    getFarm,
    grantRoleToFarm,
    isAllowedToShareFarm,
    listPrincipalsForFarm,
    lookupPrincipal,
    revokePrincipalFromFarm,
    updateRoleOfPrincipalAtFarm,
} from "@svenvw/fdm-core"
import isEmail from "validator/lib/isEmail"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    useLoaderData,
} from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { AccessInfoCard } from "~/components/blocks/access/access-info-card"
import { AccessManagementCard } from "~/components/blocks/access/access-management-card"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import {
    renderFarmInvitationEmail,
    sendEmail,
} from "~/lib/email.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { AccessFormSchema } from "~/lib/schemas/access.schema"
import { Header } from "../components/blocks/header/base"
import { HeaderFarmCreate } from "../components/blocks/header/create-farm"
import { SidebarInset } from "../components/ui/sidebar"

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Toegang instellen - Bedrijf aanmaken | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Stel in wie toegang heeft tot dit nieuwe bedrijf.",
        },
    ]
}

// Loader
// TODO: Verify farm exists (it should, as it was just created)
// TODO: Ensure principal fetching logic is correct for the creator
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", { status: 400 })
        }
        const calendar = getCalendar(params) // Get calendar year

        const session = await getSession(request)

        // Fetch farm details (mainly for name in breadcrumbs, maybe owner check)
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)
        if (!farm) {
            throw data("Farm not found", { status: 404 })
        }

        const principals = await listPrincipalsForFarm(
            fdm,
            session.principal_id,
            b_id_farm,
        )

        const hasSharePermission = await isAllowedToShareFarm(
            fdm,
            session.principal_id,
            b_id_farm,
        )

        return {
            b_id_farm: b_id_farm,
            b_name_farm: farm.b_name_farm,
            principals: principals,
            hasSharePermission: hasSharePermission,
            calendar: calendar,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

// Default Component
// TODO: Add wizard-specific layout/header/breadcrumbs
// TODO: Add "Voltooien" button with correct navigation
export default function CreateFarmAccessStep() {
    const { b_id_farm, b_name_farm, principals, hasSharePermission, calendar } =
        useLoaderData<typeof loader>()

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarmCreate b_name_farm={b_name_farm} />
            </Header>
            <main>
                <div className="space-y-6 p-10 pb-0">
                    <div className="flex items-center">
                        <div className="space-y-0.5">
                            <h2 className="text-2xl font-bold tracking-tight mt-2">
                                Toegang instellen (Optioneel)
                            </h2>
                            <p className="text-muted-foreground">
                                Nodig nu alvast gebruikers of organisaties uit,
                                of voltooi de wizard.
                            </p>
                        </div>

                        <div className="ml-auto">
                            <Button asChild>
                                <NavLink to={`/farm/${b_id_farm}`}>
                                    {" "}
                                    {/* Navigate to the main farm page */}
                                    Voltooien
                                </NavLink>
                            </Button>
                        </div>
                    </div>
                    <Separator className="my-6" />
                    <div className="grid md:grid-cols-3 gap-4">
                        <AccessManagementCard
                            principals={principals}
                            hasSharePermission={hasSharePermission}
                        />
                        <AccessInfoCard />
                    </div>
                </div>
            </main>
        </SidebarInset>
    )
}

// Action
// TODO: Ensure action logic correctly uses session.user.id (or principal_id)
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw new Error("missing: b_id_farm")
        }
        const formValues = await extractFormValuesFromRequest(
            request,
            AccessFormSchema,
        )

        const session = await getSession(request)
        const principalId = session.principal_id

        if (!principalId) {
            throw data("User not authenticated", { status: 401 })
        }

        if (formValues.intent === "invite_user") {
            if (!formValues.username) {
                return dataWithError(
                    null,
                    "Gebruikersnaam/Organisatie is verplicht.",
                )
            }
            if (!formValues.role) {
                return dataWithError(null, "Rol is verplicht.")
            }
            await grantRoleToFarm(
                fdm,
                principalId,
                formValues.username,
                b_id_farm,
                formValues.role,
            )

            // Send invitation email
            try {
                const farm = await getFarm(fdm, principalId, b_id_farm)
                const inviterName = session.userName
                const normalizedTarget = formValues.username.toLowerCase().trim()
                const isEmailTarget = isEmail(normalizedTarget)

                const matchedPrincipals = await lookupPrincipal(fdm, normalizedTarget)
                const targetPrincipal = matchedPrincipals.find(
                    (p) =>
                        p.username.toLowerCase() === normalizedTarget ||
                        (isEmailTarget && p.email?.toLowerCase() === normalizedTarget),
                )

                const targetEmail = isEmailTarget
                    ? normalizedTarget
                    : targetPrincipal?.type === "user"
                      ? targetPrincipal.email
                      : null

                if (targetEmail) {
                    const isUnregistered = !targetPrincipal
                    const email = await renderFarmInvitationEmail(
                        targetEmail,
                        inviterName,
                        farm.b_name_farm ?? b_id_farm,
                        formValues.role,
                        isUnregistered,
                    )
                    await sendEmail(email)
                }
            } catch (emailError) {
                console.error("Error sending farm invitation email:", emailError)
            }

            return dataWithSuccess(null, {
                message: `${formValues.username} is uitgenodigd!`,
            })
        }

        if (formValues.intent === "update_role") {
            if (!formValues.username) {
                return dataWithError(
                    null,
                    "Gebruikersnaam/Organisatie is verplicht.",
                )
            }
            if (!formValues.role) {
                return dataWithError(null, "Rol is verplicht.")
            }
            await updateRoleOfPrincipalAtFarm(
                fdm,
                principalId,
                formValues.username,
                b_id_farm,
                formValues.role,
            )
            return dataWithSuccess(null, { message: "Rol is bijgewerkt!" })
        }

        if (formValues.intent === "remove_user") {
            if (!formValues.username) {
                return dataWithError(
                    null,
                    "Gebruikersnaam/Organisatie is verplicht.",
                )
            }
            await revokePrincipalFromFarm(
                fdm,
                principalId,
                formValues.username,
                b_id_farm,
            )
            return dataWithSuccess(null, {
                message: `Toegang voor ${formValues.username} ingetrokken.`,
            })
        }

        throw new Error("Invalid intent")
    } catch (error) {
        console.error(error)
        return dataWithError(null, "Er is iets misgegaan")
        // throw handleActionError(error)
    }
}
