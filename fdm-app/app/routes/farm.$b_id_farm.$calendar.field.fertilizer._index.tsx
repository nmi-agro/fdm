import {
  getCultivationsForFarm,
  getFarms,
  getFertilizerApplication,
  getFields,
} from "@nmi-agro/fdm-core"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
  useLoaderData,
  useLocation,
  useSearchParams,
} from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { BulkFertilizerPage } from "~/components/blocks/fertilizer-applications/bulk/bulk-page"
import { FormSchema } from "~/components/blocks/fertilizer-applications/formschema"
import { Header } from "~/components/blocks/header/base"
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
  addFertilizerApplicationToFields,
  captureBulkFertilizerApplicationAdded,
  getFertilizerOptions,
  toBulkFieldOptions,
} from "~/lib/fertilizer-application-bulk.server"
import { parseAppIds } from "~/lib/fertilizer-application-helpers"
import { extractFormValuesFromRequest } from "~/lib/form"
import { isOfOrigin } from "~/lib/url-utils"

export const meta: MetaFunction = () => {
  return [
    { title: `Bemesting toevoegen | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Voeg één bemesting toe aan meerdere percelen en zie direct het effect op gebruiksruimte, advies en stikstofbalans.",
    },
  ]
}

export async function loader({ request, params, url }: LoaderFunctionArgs) {
  try {
    // Get the active farm
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("missing: b_id_farm", {
        status: 400,
        statusText: "missing: b_id_farm",
      })
    }

    // Get the session
    const session = await getSession(request)

    // Changing applications has its own page now; send old links with `appIds` there
    if (url.searchParams.has("appIds")) {
      const applicationRefs = parseAppIds(url.searchParams.get("appIds") ?? "")
      const first = applicationRefs[0]
        ? await getFertilizerApplication(fdm, session.principal_id, applicationRefs[0].p_app_id)
        : undefined
      if (!first) {
        throw data("invalid: appIds", { status: 400, statusText: "invalid: appIds" })
      }
      const fieldIds = [...new Set(applicationRefs.map((ref) => ref.b_id))]
      return redirect(
        `/farm/${b_id_farm}/${params.calendar}/field/modify_fertilizer/${first.p_id}?fieldIds=${fieldIds.map(encodeURIComponent).join(",")}`,
      )
    }

    // Determine where to return after saving/cancelling
    const returnUrlParam = url.searchParams.get("returnUrl")
    const returnUrl =
      returnUrlParam && isOfOrigin(returnUrlParam, url.origin)
        ? returnUrlParam
        : `/farm/${b_id_farm}/${params.calendar}/field`

    // Get fieldIds from search params; without any, the page asks to select fields
    const fieldIds = url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? []

    // Get timeframe from calendar store
    const timeframe = getTimeframe(params)
    const calendar = getCalendar(params)

    // Get a list of possible farms of the user
    const farms = await getFarms(fdm, session.principal_id)

    // Redirect to farms overview if user has no farm
    if (farms.length === 0) {
      return redirect("./farm")
    }

    // Get farms to be selected
    const farmOptions = farms.map((farm) => {
      if (!farm?.b_id_farm || !farm?.b_name_farm) {
        throw new Error("Invalid farm data structure")
      }
      return {
        b_id_farm: farm.b_id_farm,
        b_name_farm: farm.b_name_farm,
      }
    })

    // Get the fields of the farm, their cultivations and the available fertilizers
    const [fields, cultivationsByField, fertilizerOptions] = await Promise.all([
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getFertilizerOptions(fdm, session.principal_id, b_id_farm),
    ])
    const fieldOptions = toBulkFieldOptions(fields, cultivationsByField, calendar)

    const selectedFieldIds = fieldOptions
      .filter((field) => fieldIds.includes(field.b_id))
      .map((field) => field.b_id)

    // Start calculating the impact on norms, advice and balance; streamed to the page
    const current = loadBulkCurrentState({
      fdm,
      principal_id: session.principal_id,
      b_id_farm,
      calendar,
      timeframe,
      farmFields: fields,
      selectedFieldIds,
    })

    return {
      b_id_farm: b_id_farm,
      farmOptions: farmOptions,
      fertilizerOptions: fertilizerOptions,
      calendar: calendar,
      selectedFieldIds,
      fieldOptions: fieldOptions,
      returnUrl: returnUrl,
      current,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FarmFieldFertilizerAddIndex() {
  const loaderData = useLoaderData<typeof loader>()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  return (
    <SidebarInset>
      <Header
        action={{
          to: loaderData.returnUrl,
          label: loaderData.returnUrl.includes("/rotation")
            ? "Terug naar bouwplan"
            : "Terug naar percelen",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem className="hidden md:block">Percelen</BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem className="hidden md:block">Bemesting toevoegen</BreadcrumbItem>
      </Header>
      <main>
        <FarmTitle
          title="Bemesting toevoegen"
          description="Voeg één bemesting toe aan meerdere percelen en zie direct het effect op gebruiksruimte, advies en stikstofbalans."
        />
        <FarmContent>
          <BulkFertilizerPage
            b_id_farm={loaderData.b_id_farm}
            calendar={loaderData.calendar}
            fertilizerOptions={loaderData.fertilizerOptions}
            fieldOptions={loaderData.fieldOptions}
            selectedFieldIds={loaderData.selectedFieldIds}
            cultivationIds={[]}
            current={loaderData.current}
            formAction={`${location.pathname}${location.search}`}
            formStoreKey={searchParams.get("fieldIds") || ""}
          />
        </FarmContent>
      </main>
    </SidebarInset>
  )
}

export async function action({ request, params, url }: ActionFunctionArgs) {
  try {
    const { b_id_farm, calendar = "all" } = params
    if (!b_id_farm) {
      throw new Error("Farm ID is missing")
    }

    const session = await getSession(request)

    const returnUrlParam = url.searchParams.get("returnUrl")
    const returnUrl =
      returnUrlParam && isOfOrigin(returnUrlParam, url.origin)
        ? returnUrlParam
        : url.searchParams.has("create")
          ? `/farm/create/${b_id_farm}/${calendar}/field`
          : `/farm/${b_id_farm}/${calendar}/field`

    const requestedFieldIds = url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? []
    if (requestedFieldIds.length === 0) {
      return dataWithError(null, "Selecteer eerst een perceel.")
    }

    const validatedData = await extractFormValuesFromRequest(request, FormSchema)

    const fieldIds = await addFertilizerApplicationToFields({
      fdm,
      principal_id: session.principal_id,
      b_id_farm,
      fieldIds: requestedFieldIds,
      values: validatedData,
    })

    captureBulkFertilizerApplicationAdded({
      principal_id: session.principal_id,
      b_id_farm,
      calendar: String(calendar),
      p_id: validatedData.p_id,
      fieldIds,
      source: "field_page",
      url,
    })

    return redirectWithSuccess(returnUrl, {
      message: `Bemesting succesvol toegevoegd aan ${fieldIds.length} ${fieldIds.length === 1 ? "perceel" : "percelen"}.`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return dataWithError(null, "Invoer is ongeldig. Controleer het formulier.")
    }
    return handleActionError(error)
  }
}
