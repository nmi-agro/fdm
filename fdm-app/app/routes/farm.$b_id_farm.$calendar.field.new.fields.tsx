import {
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getFarm,
  getFarms,
  getField,
  getFields,
} from "@nmi-agro/fdm-core"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  Outlet,
  useLoaderData,
} from "react-router"
import { NewFieldsSidebar } from "~/components/blocks/fields-new/sidebar"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { HeaderField } from "~/components/blocks/header/field"
import { PageContainer } from "~/components/custom/page-container"
import { Separator } from "~/components/ui/separator"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getSoilStatus, type SoilStatus } from "~/lib/soil-status"

// Meta
export const meta: MetaFunction = () => {
  return [
    { title: `Nieuw perceel | ${clientConfig.name}` },
    {
      name: "description",
      content: "Voeg nieuwe percelen toe",
    },
  ]
}

/**
 * Loads farm details, available fields, and map configuration for the field selection page.
 *
 * This loader function retrieves the farm ID from the route parameters and validates its presence. It then
 * fetches the farm details using the current session. Additionally, it loads the list of available fields
 * for the specified calendar year (or the current year if not provided) from an external source.
 * It also fetches available cultivation options from the catalogue.
 *
 * @param {LoaderFunctionArgs} args - The arguments for the loader function, including the request and parameters.
 * @returns {Promise<object>} An object containing farm details, the list of available fields, cultivation options, and other related data.
 * @throws {Response} If the farm ID is missing.
 */
export async function loader({ request, params, url }: LoaderFunctionArgs) {
  try {
    // Get the Id and name of the farm
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", {
        status: 400,
        statusText: "Farm ID is required",
      })
    }

    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)

    // Obtain the fieldIds
    // Redirect to one of them if not viewing a field currently.
    const b_id = params.b_id
    let fieldIds: string[] = b_id ? [b_id] : []
    const fieldIdsParam = url.searchParams.get("fieldIds")
    if (fieldIdsParam) fieldIds = fieldIdsParam.split(",").filter((fieldId) => fieldId.length)

    // Get the session
    const session = await getSession(request)

    // Read the farm-level data at once: the fields of the farm (all years, like getField) and the
    // current soil data of every field, instead of one read per field
    const [farm, farms, farmFields, currentSoilDataByField] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      getFields(fdm, session.principal_id, b_id_farm),
      getCurrentSoilDataForFarm(fdm, session.principal_id, b_id_farm, timeframe),
    ])

    // Get a list of possible farms of the user
    const farmOptions = farms.map((farm) => {
      if (!farm?.b_id_farm || !farm?.b_name_farm) {
        throw new Error("Invalid farm data structure")
      }
      return {
        b_id_farm: farm.b_id_farm,
        b_name_farm: farm.b_name_farm,
      }
    })

    // A requested field that is not on this farm (normally there is none) is read on its own, as
    // before
    const fieldsById = new Map(farmFields.map((field) => [field.b_id, field]))
    await Promise.all(
      fieldIds
        .filter((b_id) => !fieldsById.has(b_id))
        .map(async (b_id) => {
          const field = await getField(fdm, session.principal_id, b_id)
          fieldsById.set(b_id, field)
          currentSoilDataByField.set(
            b_id,
            await getCurrentSoilData(fdm, session.principal_id, b_id, timeframe),
          )
        }),
    )
    const fields = fieldIds.flatMap((b_id) => fieldsById.get(b_id) ?? [])

    // Get soil status for each field
    const soilStatus: Record<string, SoilStatus> = {}
    for (const field of fields) {
      soilStatus[field.b_id] = getSoilStatus(currentSoilDataByField.get(field.b_id) ?? [])
    }

    return {
      fields: fields,
      soilStatus: soilStatus,
      b_id_farm: b_id_farm,
      b_name_farm: farm.b_name_farm,
      farmOptions: farmOptions,
      calendar: calendar,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

// Main
export default function Index() {
  const loaderData = useLoaderData<typeof loader>()
  const { fields, soilStatus, b_id_farm, calendar } = loaderData

  return (
    <PageContainer>
      <Header
        action={{
          to: `/farm/${loaderData.b_id_farm}/${calendar}/field/`,
          label: "Terug naar percelen",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        <HeaderField b_id_farm={loaderData.b_id_farm} fieldOptions={[]} b_id={undefined} />
      </Header>
      <div>
        <div className="space-y-6 p-10 pb-16">
          <div className="flex items-center">
            <div className="space-y-0.5">
              <h2 className="text-2xl font-bold tracking-tight">Percelen</h2>
              <p className="text-muted-foreground">
                Pas de naam aan, controleer het gewas en bodemgegevens
              </p>
            </div>
          </div>
          <Separator className="my-6" />
          <div className="space-y-6 pb-0">
            <div className="flex flex-col space-y-0 lg:flex-row lg:space-y-0 lg:space-x-4">
              <NewFieldsSidebar
                fields={fields}
                soilStatus={soilStatus}
                b_id_farm={b_id_farm}
                calendar={calendar}
                isFarmCreateWizard={false}
              />
              <div className="flex-1">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
