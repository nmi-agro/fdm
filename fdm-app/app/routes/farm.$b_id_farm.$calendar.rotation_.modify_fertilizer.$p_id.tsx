import {
  checkPermission,
  getCultivationsForFarm,
  getFarms,
  getFertilizer,
  getFertilizerApplicationsForFarm,
  getFertilizerParametersDescription,
  getFields,
  removeFertilizerApplication,
} from "@nmi-agro/fdm-core"
import { useMemo } from "react"
import { data, type MetaFunction, redirect, useLoaderData } from "react-router"
import { dataWithSuccess, redirectWithSuccess } from "remix-toast"
import z from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import {
  type ModifiableApplication,
  ModifyFertilizerPage,
} from "~/components/blocks/fertilizer-applications/bulk/modify-fertilizer-page"
import { FormSchemaPartialModify } from "~/components/blocks/fertilizer-applications/formschema"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { SidebarInset } from "~/components/ui/sidebar"
import { loadBulkCurrentState } from "~/integrations/fertilizer-application-impact.server"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  getFertilizerOptions,
  toBulkFieldOptions,
  updateFertilizerApplications,
} from "~/lib/fertilizer-application-bulk.server"
import { parseAppIds } from "~/lib/fertilizer-application-helpers"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.rotation_.modify_fertilizer.$p_id"

export const meta: MetaFunction = () => {
  return [
    { title: `Bemesting wijzigen | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Wijzig of verwijder de giften van een meststof op meerdere percelen en zie direct het effect.",
    },
  ]
}

/**
 * Loads the applications of one fertilizer (`p_id`) on the fields in `?fieldIds=` in the
 * calendar year, with the data for the form and the streamed impact on the farm norms, advice and
 * nitrogen balance of those fields.
 *
 * The route is shared by the rotation table, the fields table and the farm creation flow; the
 * returned `variant` tells which page header to show and where to go back to.
 */
export async function loader({ params, request, url }: Route.LoaderArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("missing: b_id_farm", { status: 400, statusText: "missing: b_id_farm" })
    }
    const fieldIds = url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? []
    if (fieldIds.length === 0) {
      throw data("missing: fieldIds", { status: 400, statusText: "missing: fieldIds" })
    }

    const session = await getSession(request)
    const principal_id = session.principal_id
    const timeframe = getTimeframe(params)
    const calendar = getCalendar(params)

    const [
      farms,
      fertilizer,
      farmFields,
      cultivationsByField,
      fertilizerOptions,
      applicationsByField,
    ] = await Promise.all([
      getFarms(fdm, principal_id),
      getFertilizer(fdm, params.p_id, principal_id),
      getFields(fdm, principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
      getFertilizerOptions(fdm, principal_id, b_id_farm),
      getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    ])
    const fieldOptions = toBulkFieldOptions(farmFields, cultivationsByField, calendar)
    const fieldNames = new Map(fieldOptions.map((field) => [field.b_id, field.b_name]))

    const methodOptions =
      getFertilizerParametersDescription().find((x) => x.parameter === "p_app_method_options")
        ?.options ?? []

    // The applications of this fertilizer on the requested fields, by date
    const requested = new Set(fieldIds)
    const candidates = fieldOptions
      .filter((field) => requested.has(field.b_id))
      .flatMap((field) =>
        (applicationsByField.get(field.b_id) ?? [])
          .filter((app) => app.p_id === params.p_id)
          .map((app) => ({ ...app, b_id: field.b_id, b_name: field.b_name })),
      )
      .sort((a, b) => a.p_app_date.getTime() - b.p_app_date.getTime())
    const applications: ModifiableApplication[] = await Promise.all(
      candidates.map(async (app) => ({
        ...app,
        canModify: await checkPermission(
          fdm,
          "fertilizer_application",
          "write",
          app.p_app_id,
          principal_id,
          url.pathname,
          false,
        ),
        p_app_method_name:
          methodOptions.find((option) => option.value === app.p_app_method)?.label ?? undefined,
      })),
    )

    // Nothing left to change, for example after the last application was removed elsewhere
    if (applications.length === 0) {
      return redirect(getBackUrl(url))
    }

    // Only the fields with an application of this fertilizer are affected
    const affectedFieldIds = [...new Set(applications.map((app) => app.b_id))]
    const current = loadBulkCurrentState({
      fdm,
      principal_id,
      b_id_farm,
      calendar,
      timeframe,
      farmFields,
      selectedFieldIds: affectedFieldIds,
    })

    const isCreate = url.pathname.startsWith("/farm/create/")
    const isField = url.pathname.includes("/field/modify_fertilizer/")
    const farmName = farms.find((farm) => farm.b_id_farm === b_id_farm)?.b_name_farm ?? ""

    return {
      b_id_farm,
      calendar,
      variant: isCreate
        ? ("create" as const)
        : isField
          ? ("field" as const)
          : ("rotation" as const),
      backUrl: getBackUrl(url),
      farmName,
      farmOptions: farms.map((farm) => ({
        b_id_farm: farm.b_id_farm,
        b_name_farm: farm.b_name_farm,
      })),
      fertilizerName: fertilizer.p_name_nl ?? "Meststof",
      applications,
      fields: fieldOptions.filter((field) => affectedFieldIds.includes(field.b_id)),
      fieldNames: Object.fromEntries(fieldNames),
      fertilizerOptions,
      current,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function ModifyFertilizerRoute() {
  const loaderData = useLoaderData<typeof loader>()
  const fieldNames = useMemo(
    () => new Map(Object.entries(loaderData.fieldNames)),
    [loaderData.fieldNames],
  )
  const fieldCount = loaderData.fields.length
  const title = `${loaderData.fertilizerName} wijzigen`
  const description =
    fieldCount === 1
      ? `Giften van ${loaderData.fertilizerName} op ${loaderData.fields[0]?.b_name ?? "dit perceel"} in ${loaderData.calendar}.`
      : `Giften van ${loaderData.fertilizerName} op ${fieldCount} percelen in ${loaderData.calendar}.`
  const backLabel = loaderData.variant === "field" ? "Terug naar percelen" : "Terug naar bouwplan"

  const content = (
    <main>
      <FarmTitle title={title} description={description} />
      <FarmContent>
        <ModifyFertilizerPage
          b_id_farm={loaderData.b_id_farm}
          calendar={loaderData.calendar}
          fertilizerName={loaderData.fertilizerName}
          applications={loaderData.applications}
          fields={loaderData.fields}
          fieldNames={fieldNames}
          fertilizerOptions={loaderData.fertilizerOptions}
          current={loaderData.current}
        />
      </FarmContent>
    </main>
  )

  if (loaderData.variant === "create") {
    return (
      <>
        <Header action={{ to: loaderData.backUrl, label: backLabel, disabled: false }}>
          <HeaderFarmCreate b_name_farm={loaderData.farmName} />
        </Header>
        {content}
      </>
    )
  }

  return (
    <SidebarInset>
      <Header action={{ to: loaderData.backUrl, label: backLabel, disabled: false }}>
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem className="hidden md:block">
          {loaderData.variant === "field" ? "Percelen" : "Bouwplan"}
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem className="hidden md:block">{loaderData.fertilizerName}</BreadcrumbItem>
      </Header>
      {content}
    </SidebarInset>
  )
}

/** The table the modify page was opened from: the field table or the rotation table. */
function getBackUrl(url: URL) {
  return url.pathname.replace(/\/modify_fertilizer\/[^/]+\/?$/, "")
}

const RemoveSchema = z.object({
  intent: z.literal("remove_application"),
  /**
   * Set when every listed application is removed, so the page would be empty. The client sends
   * "true", which `extractFormValuesFromRequest` turns into a boolean.
   */
  removeAll: z.boolean().optional(),
  appIds: z
    .string()
    .transform(parseAppIds)
    .refine((ids) => ids.length > 0, { error: "missing: appIds" }),
})

/**
 * Changes the selected applications (`PUT`, with the partial form values) or removes them (`POST`
 * with intent `remove_application`).
 */
export async function action({ request, url }: Route.ActionArgs) {
  try {
    const session = await getSession(request)

    if (request.method === "PUT") {
      const values = await extractFormValuesFromRequest(request, FormSchemaPartialModify)
      const count = await updateFertilizerApplications({
        fdm,
        principal_id: session.principal_id,
        p_app_ids: values.p_app_id.split(","),
        values,
      })
      return dataWithSuccess(null, {
        message: count === 1 ? "Bemesting is gewijzigd" : `${count} bemestingen zijn gewijzigd`,
      })
    }

    const formData = await extractFormValuesFromRequest(request, RemoveSchema)
    // Queries in a transaction share one connection, so run them one after the other
    await fdm.transaction(async (tx) => {
      for (const { p_app_id } of formData.appIds) {
        await removeFertilizerApplication(tx, session.principal_id, p_app_id)
      }
    })
    const message =
      formData.appIds.length === 1 ? "Bemesting is verwijderd" : "Bemestingen zijn verwijderd"
    // Without applications left the page would be empty, so return to the table
    if (formData.removeAll) {
      return redirectWithSuccess(getBackUrl(url), { message })
    }
    return dataWithSuccess(null, { message })
  } catch (error) {
    return handleActionError(error)
  }
}
