import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import {
  addFertilizerApplication,
  checkPermission,
  getCultivationsForFarm,
  getFertilizerApplications,
  getFertilizerParametersDescription,
  getFertilizers,
  getField,
  getFields,
  removeFertilizerApplication,
  updateFertilizerApplication,
} from "@nmi-agro/fdm-core"
import { useMemo } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
} from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { FieldFertilizerPage } from "~/components/blocks/fertilizer-applications/bulk/field-fertilizer-page"
import {
  FormSchema,
  FormSchemaModify,
} from "~/components/blocks/fertilizer-applications/formschema"
import { loadBulkCurrentState } from "~/integrations/fertilizer-application-impact.server"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getFertilizerOptions, toBulkFieldOptions } from "~/lib/fertilizer-application-bulk.server"
import { extractFormValuesFromRequest } from "~/lib/form"

// Meta
export const meta: MetaFunction = () => {
  return [
    { title: `Bemesting - Perceel | ${clientConfig.name}` },
    {
      name: "description",
      content: "Bekijk en bewerk de bemestinggegevens van je perceel.",
    },
  ]
}

/**
 * Loads the fertilizer applications of a field, the data for the application form, and the
 * streamed impact of the field (farm norms, advice and nitrogen balance) including the input to
 * preview the effect of a new or changed application in the browser.
 *
 * The advice is based on the main cultivation of the year.
 *
 * @throws {Error} If the farm or field ID is missing, or if the specified field does not exist.
 */
export async function loader({ request, params, url }: LoaderFunctionArgs) {
  try {
    // Get the farm id
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", {
        status: 400,
        statusText: "Farm ID is required",
      })
    }

    // Get the field id
    const b_id = params.b_id
    if (!b_id) {
      throw data("Field ID is required", {
        status: 400,
        statusText: "Field ID is required",
      })
    }

    // Get the session
    const session = await getSession(request)
    const principal_id = session.principal_id

    // Get timeframe from calendar store
    const timeframe = getTimeframe(params)
    const calendar = getCalendar(params)

    // Get details of field
    const field = await getField(fdm, principal_id, b_id)
    if (!field) {
      throw data("Field is not found", {
        status: 404,
        statusText: "Field is not found",
      })
    }

    const [
      farmFields,
      cultivationsByField,
      fertilizers,
      fertilizerOptions,
      fertilizerApplications,
    ] = await Promise.all([
      getFields(fdm, principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
      getFertilizers(fdm, principal_id, b_id_farm),
      getFertilizerOptions(fdm, principal_id, b_id_farm),
      getFertilizerApplications(fdm, principal_id, b_id, timeframe),
    ])
    const fieldOptions = toBulkFieldOptions(farmFields, cultivationsByField, calendar)
    const fieldOption = fieldOptions.find((option) => option.b_id === b_id) ?? {
      b_id,
      b_name: field.b_name,
      b_area: Math.round((field.b_area ?? 0) * 10) / 10,
      b_bufferstrip: field.b_bufferstrip ?? false,
      cultivations: [],
      mainCultivationName: null,
      mainCultivationCropRotation: null,
    }

    const applicationMethods = getFertilizerParametersDescription().find(
      (x: { parameter: string }) => x.parameter === "p_app_method_options",
    )
    if (!applicationMethods) throw new Error("Parameter metadata missing")
    const applicationMethodOptions = (applicationMethods.options ?? [])
      .filter(
        (option): option is { value: ApplicationMethods; label: string } => option.value !== null,
      )
      .map((option) => ({ value: option.value, label: option.label }))

    // Start calculating the impact of the field; streamed to the page
    const current = loadBulkCurrentState({
      fdm,
      principal_id,
      b_id_farm,
      calendar,
      timeframe,
      farmFields: farmFields.some((f) => f.b_id === b_id) ? farmFields : [...farmFields, field],
      selectedFieldIds: [b_id],
    })

    const pathname = url.pathname
    const [fieldWritePermission, permissionEntries] = await Promise.all([
      checkPermission(fdm, "field", "write", b_id, principal_id, pathname, false),
      Promise.all(
        fertilizerApplications.map(
          async (app) =>
            [
              app.p_app_id,
              await checkPermission(
                fdm,
                "fertilizer_application",
                "write",
                app.p_app_id,
                principal_id,
                pathname,
                false,
              ),
            ] as [string, boolean],
        ),
      ),
    ])

    return {
      b_id_farm,
      calendar,
      field: fieldOption,
      fieldOptions,
      fertilizerOptions,
      fertilizers,
      fertilizerApplications,
      applicationMethodOptions,
      current,
      fieldWritePermission,
      fertilizerApplicationWritePermissions: Object.fromEntries(permissionEntries),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Renders the fertilizer page of a field: an always visible form to add or change an
 * application, the list of applications, and the impact on the farm norms, the advice and the
 * nitrogen balance before and after the change.
 */
export default function FarmFieldsOverviewBlock() {
  const loaderData = useLoaderData<typeof loader>()
  const fieldNames = useMemo(
    () => new Map(loaderData.fieldOptions.map((field) => [field.b_id, field.b_name])),
    [loaderData.fieldOptions],
  )

  return (
    <FieldFertilizerPage
      b_id_farm={loaderData.b_id_farm}
      calendar={loaderData.calendar}
      field={loaderData.field}
      fieldNames={fieldNames}
      fertilizerOptions={loaderData.fertilizerOptions}
      fertilizers={loaderData.fertilizers}
      fertilizerApplications={loaderData.fertilizerApplications}
      applicationMethodOptions={loaderData.applicationMethodOptions}
      current={loaderData.current}
      canCreate={loaderData.fieldWritePermission}
      canModify={loaderData.fertilizerApplicationWritePermissions}
    />
  )
}

/**
 * Processes form submissions to add or delete fertilizer applications for a field.
 *
 * For POST requests, this function extracts form data and uses it along with the active user session
 * to add a new fertilizer application. For DELETE requests, it validates and retrieves the application ID
 * from the form data before removing the corresponding application. The function requires a valid field
 * identifier from the URL parameters and ensures that the session is correctly retrieved.
 *
 * @returns A response object indicating the success or error outcome of the operation.
 *
 * @throws {Error} If the field identifier is missing or an unexpected error occurs during processing.
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    // Get the field ID
    const b_id = params.b_id
    if (!b_id) {
      throw new Error("missing: b_id")
    }

    // Get the session
    const session = await getSession(request)

    if (request.method === "POST") {
      // Collect form entry
      const formValues = await extractFormValuesFromRequest(request, FormSchema)
      const { p_id, p_app_amount_display, p_app_date, p_app_method } = formValues

      await addFertilizerApplication(
        fdm,
        session.principal_id,
        b_id,
        p_id,
        p_app_amount_display,
        p_app_method,
        p_app_date,
      )

      return dataWithSuccess(
        { result: "Data saved successfully" },
        { message: "Bemesting is toegevoegd! 🎉" },
      )
    }

    if (request.method === "PUT") {
      // Collect form entry
      const formValues = await extractFormValuesFromRequest(request, FormSchemaModify)
      const { p_app_id, p_id, p_app_amount_display, p_app_date, p_app_method } = formValues

      if (!p_app_id || typeof p_app_id !== "string") {
        return dataWithError(
          "Invalid or missing p_app_id value",
          "Helaas, er is wat misgegaan. Probeer het later opnieuw of neem contact op met ondersteuning.",
        )
      }

      await updateFertilizerApplication(
        fdm,
        session.principal_id,
        p_app_id,
        p_id,
        p_app_amount_display,
        p_app_method,
        p_app_date,
      )

      return dataWithSuccess(
        { result: "Data saved successfully" },
        { message: "Bemesting is gewijzigd" },
      )
    }

    if (request.method === "DELETE") {
      const formData = await request.formData()
      const p_app_id = formData.get("p_app_id")

      if (!p_app_id || typeof p_app_id !== "string") {
        return dataWithError(
          "Invalid or missing p_app_id value",
          "Helaas, er is wat misgegaan. Probeer het later opnieuw of neem contact op met ondersteuning.",
        )
      }

      await removeFertilizerApplication(fdm, session.principal_id, p_app_id)

      return dataWithSuccess("Date deleted successfully", {
        message: "Bemesting is verwijderd",
      })
    }
  } catch (error) {
    return handleActionError(error)
  }
}
