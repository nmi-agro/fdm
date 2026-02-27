import {
    checkPermission,
    getFertilizer,
    getFertilizerApplications,
    getFertilizerParametersDescription,
    getField,
    removeFertilizerApplication,
} from "@nmi-agro/fdm-core"
import { data, useLoaderData, useNavigate } from "react-router"
import { dataWithSuccess } from "remix-toast"
import z from "zod"
import { FertilizerApplicationListDialog } from "~/components/blocks/fertilizer-applications/dialog"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { parseAppIds } from "~/lib/fertilizer-application-helpers"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.rotation.modify_fertilizer.$p_id"

interface FertilizerInfo {
    p_id: string
    p_name_nl: string | null
}

export async function loader({ params, request }: Route.LoaderArgs) {
    try {
        const session = await getSession(request)

        const url = new URL(request.url)

        const fieldIds = url.searchParams
            .get("fieldIds")
            ?.split(",")
            .filter((b_id) => b_id.length > 0)
        if (!fieldIds || fieldIds.length === 0) {
            throw data("missing: fieldIds", {
                status: 400,
                statusText: "missing: fieldIds",
            })
        }

        const originalFertilizer = await getFertilizer(fdm, params.p_id)
        const fertilizer: FertilizerInfo = {
            p_id: originalFertilizer.p_id,
            p_name_nl: originalFertilizer.p_name_nl,
        }

        const allApplicationsPerField = await Promise.all(
            fieldIds.map(async (b_id) => {
                const field = await getField(fdm, session.principal_id, b_id)
                return getFertilizerApplications(
                    fdm,
                    session.principal_id,
                    b_id,
                ).then((apps) =>
                    apps.map((app) => ({
                        ...app,
                        b_id: b_id,
                        b_name: field.b_name,
                    })),
                )
            }),
        )

        const applicationsPerField = allApplicationsPerField.map(
            (allApplications) =>
                allApplications
                    .filter((app) => app.p_id === params.p_id)
                    .sort(
                        (app1, app2) =>
                            app1.p_app_date.getTime() -
                            app2.p_app_date.getTime(),
                    ),
        )

        const fertilizerParameterDescription =
            getFertilizerParametersDescription()
        const applicationMethods = fertilizerParameterDescription.find(
            (x: { parameter: string }) =>
                x.parameter === "p_app_method_options",
        )
        if (!applicationMethods) throw new Error("Parameter metadata missing")

        const applicationsExtended = await Promise.all(
            applicationsPerField.map((applications) =>
                Promise.all(
                    applications.map(async (application) => {
                        const canModify = await checkPermission(
                            fdm,
                            "fertilizer_application",
                            "write",
                            application.p_app_id,
                            session.principal_id,
                            "RotationTableFertilizerApplicationListDialog",
                            false,
                        )
                        return {
                            ...application,
                            canModify: canModify,
                            p_app_method_name: applicationMethods.options?.find(
                                (option) =>
                                    option.value === application.p_app_method,
                            )?.label,
                        }
                    }),
                ),
            ),
        )

        const returnUrl = `${url.pathname}${url.search}`

        return {
            isForRotation: !url.pathname.includes("/field/"),
            numFields: fieldIds.length,
            fertilizer: fertilizer,
            fertilizerApplications: applicationsExtended,
            returnUrl: returnUrl,
        }
    } catch (e) {
        throw handleLoaderError(e)
    }
}

export default function FertilizerApplicationListDialogRoute() {
    const {
        isForRotation,
        numFields,
        fertilizer,
        fertilizerApplications,
        returnUrl,
    } = useLoaderData<typeof loader>()

    const navigate = useNavigate()

    return (
        <FertilizerApplicationListDialog
            isForRotation={isForRotation}
            numFields={numFields}
            fertilizer={fertilizer}
            fertilizerApplications={fertilizerApplications}
            returnUrl={returnUrl}
            onClose={() => navigate("..")}
        />
    )
}

const FormSchema = z.discriminatedUnion("intent", [
    z.object({
        intent: z.literal("remove_application"),
        appIds: z
            .string()
            .transform(parseAppIds)
            .refine((ids) => ids.length > 0, {
                error: "missing: appIds",
            }),
    }),
])

export async function action({ request }: Route.ActionArgs) {
    try {
        const session = await getSession(request)

        const formData = await extractFormValuesFromRequest(request, FormSchema)

        if (formData.intent === "remove_application") {
            await fdm.transaction((tx) =>
                Promise.all(
                    formData.appIds.map(({ p_app_id }) =>
                        removeFertilizerApplication(
                            tx,
                            session.principal_id,
                            p_app_id,
                        ),
                    ),
                ),
            )
            return dataWithSuccess(
                null,
                formData.appIds.length === 1
                    ? "Bemesting is verwijderd"
                    : "Bemestingen zijn verwijderd",
            )
        }

        throw Error(`invalid intent: ${formData.intent}`)
    } catch (e) {
        throw handleActionError(e)
    }
}
