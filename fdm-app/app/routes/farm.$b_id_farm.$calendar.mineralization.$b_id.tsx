import { getField } from "@nmi-agro/fdm-core"
import { data, type LoaderFunctionArgs, Outlet, useLoaderData } from "react-router"
import { FieldNotAvailableForYear } from "~/components/blocks/field/not-available-for-year"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getFieldAvailability } from "~/lib/field-availability"

/**
 * Loads the field and checks whether it is managed during the selected calendar year.
 *
 * @returns The field, the farm ID, the selected calendar year and `fieldAvailability`: `null` when
 * the field is managed in the selected calendar year, otherwise whether it has not started yet or
 * has already ended.
 * @throws {Response} If the farm ID or field ID is missing (400) or the field is not found (404).
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const b_id = params.b_id
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", {
        status: 400,
        statusText: "invalid: b_id_farm",
      })
    }
    if (!b_id) {
      throw data("invalid: b_id", {
        status: 400,
        statusText: "invalid: b_id",
      })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)

    const field = await getField(fdm, session.principal_id, b_id)
    if (!field) {
      throw data("not found: b_id", {
        status: 404,
        statusText: "not found: b_id",
      })
    }

    return {
      field,
      b_id_farm,
      fieldAvailability: getFieldAvailability(field, timeframe),
      calendar: params.calendar ?? "",
    }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}

export default function MineralizationFieldLayout() {
  const loaderData = useLoaderData<typeof loader>()

  if (loaderData.fieldAvailability) {
    return (
      <FieldNotAvailableForYear
        availability={loaderData.fieldAvailability}
        calendar={loaderData.calendar}
        b_name={loaderData.field.b_name}
        b_start={loaderData.field.b_start}
        b_end={loaderData.field.b_end}
        settingsHref={`/farm/${loaderData.b_id_farm}/${loaderData.calendar}/field/${loaderData.field.b_id}/settings`}
      />
    )
  }

  return <Outlet />
}
