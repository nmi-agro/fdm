import {
    acceptInvitation,
    cancelInvitationForFarm,
    declineInvitation,
    getFarm,
    grantRoleToFarm,
    isAllowedToShareFarm,
    listPrincipalsForFarm,
    lookupPrincipal,
    revokePrincipalFromFarm,
    updateRoleOfInvitationForFarm,
    updateRoleOfPrincipalAtFarm,
} from "@nmi-agro/fdm-core"
import isEmail from "validator/lib/isEmail"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { AccessInfoCard } from "~/components/blocks/access/access-info-card"
import { AccessManagementCard } from "~/components/blocks/access/access-management-card"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { AccessFormSchema } from "~/lib/schemas/access.schema"
import {
    renderFarmInvitationEmail,
    renderFarmInvitationCancelledEmail,
    renderFarmInvitationRoleUpdatedEmail,
    sendEmail,
    isInactiveRecipientError,
} from "~/lib/email.server"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Toegang - Instellingen - Bedrijf | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk en bewerk de toegang tot je bedrijf.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get the farm details ( to check if has access to farm)
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)
        if (!farm) {
            throw data("Farm is not found", {
                status: 404,
                statusText: "Farm is not found",
            })
        }

        // Get principals with access to this farm
        const principals = await listPrincipalsForFarm(
            fdm,
            session.principal_id,
            b_id_farm,
        )

        // Check if user has share permission
        const hasSharePermission = await isAllowedToShareFarm(
            fdm,
            session.principal_id,
            b_id_farm,
        )

        // Return user information from loader
        return {
            b_id_farm: b_id_farm,
            principals: principals,
            hasSharePermission: hasSharePermission,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmSettingsAccessBlock() {
    const { principals, hasSharePermission } = useLoaderData<typeof loader>()

    return (
        <div className="grid md:grid-cols-3 gap-4">
            <AccessManagementCard
                principals={principals}
                hasSharePermission={hasSharePermission}
            />
            <AccessInfoCard />
        </div>
    )
}

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

        if (formValues.intent === "invite_user") {
            if (!formValues.username) {
                return dataWithError(
                    null,
                    "Vul een gebruikers- of organisatienaam in om uit te nodigen",
                )
            }
            if (!formValues.role) {
                return handleActionError("missing: role")
            }
            await grantRoleToFarm(
                fdm,
                session.principal_id,
                formValues.username,
                b_id_farm,
                formValues.role,
            )

            // Send invitation email
            let targetPrincipal: any = null;
            try {
                const farm = await getFarm(fdm, session.principal_id, b_id_farm)
                const inviterName = session.userName
                const normalizedTarget = formValues.username.toLowerCase().trim()
                const isEmailTarget = isEmail(normalizedTarget)

                // Try to find the principal to get their email if they are registered
                const matchedPrincipals = await lookupPrincipal(fdm, normalizedTarget)
                targetPrincipal = matchedPrincipals.find(
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
                if (isInactiveRecipientError(emailError)) {
                    // Only revoke if we resolved a registered principal;
                    // otherwise (email-only invite), keep the pending invitation.
                    if (targetPrincipal && targetPrincipal.type === "user") {
                        await revokePrincipalFromFarm(
                            fdm,
                            session.principal_id,
                            formValues.username,
                            b_id_farm,
                        )
                    }
                    return dataWithError(
                        null,
                        `We kunnen geen e-mails naar ${formValues.username} sturen omdat het als inactief is gemarkeerd. Neem contact op met de ondersteuning voor hulp.`,
                    )
                }
            }

            return dataWithSuccess(null, {
                message: `${formValues.username} is uitgenodigd! 🎉`,
            })
        }

        if (formValues.intent === "accept_farm_invitation") {
            if (!formValues.invitation_id) {
                return handleActionError("missing: invitation_id")
            }
            await acceptInvitation(
                fdm,
                formValues.invitation_id,
                session.user.id,
            )
            return dataWithSuccess(null, {
                message: "Uitnodiging geaccepteerd! 🎉",
            })
        }

        if (formValues.intent === "decline_farm_invitation") {
            if (!formValues.invitation_id) {
                return handleActionError("missing: invitation_id")
            }
            await declineInvitation(
                fdm,
                formValues.invitation_id,
                session.user.id,
            )
            return dataWithSuccess(null, {
                message: "Uitnodiging geweigerd.",
            })
        }

        if (formValues.intent === "update_role") {
            if (!formValues.username) {
                return handleActionError("missing: username")
            }
            if (!formValues.role) {
                return handleActionError("missing: role")
            }
            if (formValues.invitation_id) {
                // Pending invitation — update the invitation's role
                await updateRoleOfInvitationForFarm(
                    fdm,
                    session.user.id,
                    formValues.invitation_id,
                    formValues.role,
                )
                // Send role-updated notification email; failure is non-fatal as the role was already updated
                try {
                    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
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
                        const email = await renderFarmInvitationRoleUpdatedEmail(
                            targetEmail,
                            session.userName,
                            farm.b_name_farm ?? b_id_farm,
                            formValues.role,
                        )
                        await sendEmail(email)
                    }
                } catch (emailError) {
                    console.error("Error sending role-updated invitation email:", emailError)
                }
            } else {
                await updateRoleOfPrincipalAtFarm(
                    fdm,
                    session.user.id,
                    formValues.username,
                    b_id_farm,
                    formValues.role,
                )
            }
            return dataWithSuccess(null, {
                message: "Rol is bijgewerkt! 🎉",
            })
        }

        if (formValues.intent === "remove_user") {
            if (!formValues.username) {
                return handleActionError("missing: username")
            }
            if (formValues.invitation_id) {
                // Pending invitation — cancel it
                await cancelInvitationForFarm(
                    fdm,
                    session.user.id,
                    formValues.invitation_id,
                )
                // Send cancellation notification email; failure is non-fatal as the invitation was already cancelled
                try {
                    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
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
                        const email = await renderFarmInvitationCancelledEmail(
                            targetEmail,
                            session.userName,
                            farm.b_name_farm ?? b_id_farm,
                        )
                        await sendEmail(email)
                    }
                } catch (emailError) {
                    console.error("Error sending invitation cancelled email:", emailError)
                }
            } else {
                await revokePrincipalFromFarm(
                    fdm,
                    session.user.id,
                    formValues.username,
                    b_id_farm,
                )
            }
            return dataWithSuccess(null, {
                message: `Gebruiker ${formValues.username} is verwijderd`,
            })
        }
        throw new Error("invalid intent")
    } catch (error) {
        return handleActionError(error)
    }
}
