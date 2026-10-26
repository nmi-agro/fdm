import {
  getCultivationsForFarm,
  getCultivationsFromCatalogue,
  getFarms,
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
} from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { BulkFertilizerPage } from "~/components/blocks/fertilizer-applications/bulk/bulk-page"
import { FormSchema } from "~/components/blocks/fertilizer-applications/formschema"
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
  addFertilizerApplicationToFields,
  captureBulkFertilizerApplicationAdded,
  getFertilizerOptions,
  toBulkFieldOptions,
} from "~/lib/fertilizer-application-bulk.server"
import { extractFormValuesFromRequest } from "~/lib/form"

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

    // Get cultivationIds from search params
    const cultivationIds = url.searchParams.get("cultivationIds")?.split(",").filter(Boolean) ?? []
    if (cultivationIds.length === 0) {
      throw data("missing: cultivationIds", {
        status: 400,
        statusText: "missing: cultivationIds",
      })
    }

    // Get the session
    const session = await getSession(request)

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

    // Get the fields of the farm, their cultivations, the crop catalogue and the fertilizers
    const [fields, cultivationsByField, cultivationCatalogue, fertilizerOptions] =
      await Promise.all([
        getFields(fdm, session.principal_id, b_id_farm, timeframe),
        getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getCultivationsFromCatalogue(fdm, session.principal_id, b_id_farm),
        getFertilizerOptions(fdm, session.principal_id, b_id_farm),
      ])
    const fieldOptions = toBulkFieldOptions(fields, cultivationsByField, calendar)

    const cultivationName =
      cultivationCatalogue.find(
        (c: { b_lu_catalogue: string }) => c.b_lu_catalogue === cultivationIds[0],
      )?.b_lu_name ?? ""

    // Use the fields in the search params, or default to the fields with the selected crop
    const fieldIdsFromSearchParams =
      url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? null
    const selectedFieldIds = fieldOptions
      .filter((field) =>
        fieldIdsFromSearchParams
          ? fieldIdsFromSearchParams.includes(field.b_id)
          : field.cultivations.some((c) => cultivationIds.includes(c)),
      )
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
      fieldOptions,
      cultivationName: cultivationName,
      cultivationIds: cultivationIds,
      create: url.searchParams.has("create"),
      current,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FarmRotationFertilizerAddIndex() {
  const loaderData = useLoaderData<typeof loader>()
  const location = useLocation()
  const rotationUrl = loaderData.create
    ? `/farm/create/${loaderData.b_id_farm}/${loaderData.calendar}/rotation`
    : `/farm/${loaderData.b_id_farm}/${loaderData.calendar}/rotation`

  const farmName =
    loaderData.farmOptions.find((farm) => farm.b_id_farm === loaderData.b_id_farm)?.b_name_farm ??
    ""
  const back = { to: rotationUrl, label: "Terug naar bouwplan", disabled: false }

  const content = (
    <main>
      <FarmTitle
        title={`Bemesting toevoegen aan ${loaderData.cultivationName || "bouwplan"}`}
        description="Voeg één bemesting toe aan meerdere percelen en zie direct het effect op gebruiksruimte, advies en stikstofbalans."
      />
      <FarmContent>
        <BulkFertilizerPage
          b_id_farm={loaderData.b_id_farm}
          calendar={loaderData.calendar}
          fertilizerOptions={loaderData.fertilizerOptions}
          fieldOptions={loaderData.fieldOptions}
          selectedFieldIds={loaderData.selectedFieldIds}
          cultivationIds={loaderData.cultivationIds}
          cultivationName={loaderData.cultivationName}
          current={loaderData.current}
          formAction={`${location.pathname}${location.search}`}
          formStoreKey={loaderData.cultivationIds.join(",") || "cultivationIds"}
          overviewUrl={rotationUrl}
        />
      </FarmContent>
    </main>
  )

  // In the farm creation wizard, keep the wizard header so the user stays in the flow
  if (loaderData.create) {
    return (
      <>
        <Header action={back}>
          <HeaderFarmCreate b_name_farm={farmName} />
        </Header>
        {content}
      </>
    )
  }

  return (
    <SidebarInset>
      <Header action={back}>
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem className="hidden md:block">Bouwplan</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="hidden md:block">Bemesting toevoegen</BreadcrumbItem>
      </Header>
      {content}
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
      source: "rotation_table",
      url,
    })

    return redirectWithSuccess(
      url.searchParams.has("create")
        ? `/farm/create/${b_id_farm}/${calendar}/rotation`
        : `/farm/${b_id_farm}/${calendar}/rotation`,
      {
        message: `Bemesting succesvol toegevoegd aan ${fieldIds.length} ${fieldIds.length === 1 ? "perceel" : "percelen"}.`,
      },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return dataWithError(null, "Invoer is ongeldig. Controleer het formulier.")
    }
    return handleActionError(error)
  }
}
