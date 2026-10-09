import {
  type Cultivation,
  type Fertilizer,
  addFarmToGroup,
  getCultivations,
  getFarms,
  getFertilizerApplications,
  getFertilizers,
  getFields,
  listFarmGroups,
  listPrincipalsForFarm,
  removeFarmFromGroup,
} from "@nmi-agro/fdm-core"
import { data, NavLink, useLoaderData } from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { columns, type FarmExtended } from "~/components/blocks/farms/columns"
import { DataTable } from "~/components/blocks/farms/table"
import { NoFarmsMessage } from "~/components/blocks/organization/no-farms-message"
import { Button } from "~/components/ui/button"
import { auth, getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { getDefaultJoinDate, getFarmGroupErrorMessage, parseDateInput } from "~/lib/farm-groups"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/organization.$slug.$calendar.farms._index"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Bedrijven - Organisatie | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk en beheer de bedrijven waartoe jouw organisatie toegang heeft.",
    },
  ]
}

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const timeframe = getTimeframe(params)

    const organizations = await auth.api.listOrganizations({
      headers: request.headers,
    })
    const organization = organizations.find((org) => org.slug === params.slug)

    if (!organization) {
      throw data("Organisatie niet gevonden.", {
        status: 404,
        statusText: "Organisatie niet gevonden.",
      })
    }

    const session = await getSession(request)
    const farms = await getFarms(fdm, organization.id)
    const groups = await listFarmGroups(fdm, session.principal_id, organization.id)
    const groupsOfFarm = (b_id_farm: string) =>
      groups
        .filter((group) => group.b_id_farms.includes(b_id_farm))
        .map((group) => ({ b_id_group: group.b_id_group, b_name_group: group.b_name_group }))

    const allFarms: FarmExtended[] = await Promise.all(
      farms.map(async (farm) => {
        const myOrganization = organization
        async function getOwners() {
          const accessors = (
            await listPrincipalsForFarm(fdm, myOrganization.id, farm.b_id_farm)
          ).filter((accessor) => accessor.type === "user")

          return accessors.filter((accessor) => accessor.role === "owner")
        }

        async function reduceFields() {
          const fields = await getFields(fdm, myOrganization.id, farm.b_id_farm, timeframe)

          // Total area
          let b_area = 0
          fields.forEach((field) => {
            b_area += field.b_area ?? 0
          })

          const fertilizers = await getFertilizers(fdm, myOrganization.id, farm.b_id_farm)

          const fieldsExtended: FarmExtended[] = await Promise.all(
            fields.map(async (field) => {
              const cultivations = getCultivations(fdm, myOrganization.id, field.b_id, timeframe)

              const fertilizerApplications = getFertilizerApplications(
                fdm,
                myOrganization.id,
                field.b_id,
                timeframe,
              )

              const collectedCultivations: Record<
                string,
                Pick<Cultivation, "b_lu_catalogue" | "b_lu_name" | "b_lu_croprotation">
              > = {}

              const collectedFertilizers: Record<
                string,
                Pick<Fertilizer, "p_id" | "p_name_nl" | "p_type" | "p_type_rvo">
              > = {}

              ;(await cultivations).forEach((cultivation) => {
                collectedCultivations[cultivation.b_lu_catalogue] ??= {
                  b_lu_catalogue: cultivation.b_lu_catalogue,
                  b_lu_name: cultivation.b_lu_name,
                  b_lu_croprotation: cultivation.b_lu_croprotation,
                }
              })

              ;(await fertilizerApplications).forEach((fertilizerApplication) => {
                const fertilizer = fertilizers.find(
                  (fertilizer) => fertilizer.p_id === fertilizerApplication.p_id,
                )

                if (fertilizer) {
                  collectedFertilizers[fertilizer.p_id] = {
                    p_id: fertilizer.p_id,
                    p_name_nl: fertilizer.p_name_nl,
                    p_type: fertilizer.p_type,
                    p_type_rvo: fertilizer.p_type_rvo,
                  }
                }
              })

              return {
                type: "field",
                b_id_farm: field.b_id,
                b_name_farm: field.b_name,
                owner: null,
                b_area: field.b_area,
                cultivations: Object.values(collectedCultivations),
                fertilizers: Object.values(collectedFertilizers),
              }
            }),
          )

          const collectedCultivations: Record<
            string,
            Pick<Cultivation, "b_lu_catalogue" | "b_lu_name" | "b_lu_croprotation">
          > = {}

          const collectedFertilizers: Record<
            string,
            Pick<Fertilizer, "p_id" | "p_name_nl" | "p_type" | "p_type_rvo">
          > = {}

          for (const field of fieldsExtended) {
            field.cultivations.forEach((cultivation) => {
              collectedCultivations[cultivation.b_lu_catalogue] ??= cultivation
            })
            field.fertilizers.forEach((fertilizer) => {
              collectedFertilizers[fertilizer.p_id] ??= fertilizer
            })
          }

          return {
            fields: fieldsExtended,
            b_area: b_area,
            cultivations: Object.values(collectedCultivations),
            fertilizers: Object.values(collectedFertilizers),
          }
        }

        const ownersPromise = getOwners()
        const reduceFieldsPromise = reduceFields()
        const farmGroups = groupsOfFarm(farm.b_id_farm)
        const reduced = await reduceFieldsPromise

        return {
          type: "farm",
          b_id_farm: farm.b_id_farm,
          b_name_farm: farm.b_name_farm,
          owners: await ownersPromise,
          groups: farmGroups,
          ...reduced,
          // Fields carry the groups of their farm so that filtering on a group keeps them
          fields: reduced.fields.map((field) => ({ ...field, groups: farmGroups })),
        }
      }),
    )

    return {
      data: allFarms,
      organization,
      defaultJoined: getDefaultJoinDate(params.calendar),
      groups: groups.map((group) => ({
        b_id_group: group.b_id_group,
        b_name_group: group.b_name_group,
      })),
    }
  } catch (e) {
    throw handleLoaderError(e)
  }
}

/**
 * Assigns the selected farms to groups of the organization (intent `assign_groups`).
 *
 * Every `add_group` gets all `b_id_farm` as part of the group from `b_group_joined` (and until
 * `b_group_leaved` when given). Every `remove_group` ends their membership on `b_group_leaved`
 * (default: today). These are the dates of the period itself, not the moment of the change.
 */
export async function action({ request, params }: Route.ActionArgs) {
  try {
    const session = await getSession(request)
    const organizations = await auth.api.listOrganizations({ headers: request.headers })
    const organization = organizations.find((org) => org.slug === params.slug)
    if (!organization) {
      throw data("Organisatie niet gevonden.", {
        status: 404,
        statusText: "Organisatie niet gevonden.",
      })
    }

    const formData = await request.formData()
    if (formData.get("intent") !== "assign_groups") {
      throw data("Ongeldige actie", { status: 400 })
    }
    const farmIds = formData.getAll("b_id_farm").map(String)
    const addGroupIds = formData.getAll("add_group").map(String)
    const removeGroupIds = formData.getAll("remove_group").map(String)
    const b_group_joined = parseDateInput(formData.get("b_group_joined"))
    const b_group_leaved = parseDateInput(formData.get("b_group_leaved"))
    if (b_group_joined && b_group_leaved && b_group_leaved <= b_group_joined) {
      return dataWithError(null, {
        message:
          "De datum tot wanneer de bedrijven deel uitmaken van de groep moet na de startdatum liggen.",
      })
    }
    if (farmIds.length === 0) {
      return dataWithError(null, { message: "Selecteer eerst een of meer bedrijven." })
    }

    // Groups and farms must belong to this organization
    const groups = await listFarmGroups(fdm, session.principal_id, organization.id)
    const knownGroupIds = new Set(groups.map((group) => group.b_id_group))
    const organizationFarmIds = new Set(
      (await getFarms(fdm, organization.id)).map((farm) => farm.b_id_farm),
    )
    if (
      [...addGroupIds, ...removeGroupIds].some((b_id_group) => !knownGroupIds.has(b_id_group)) ||
      farmIds.some((b_id_farm) => !organizationFarmIds.has(b_id_farm))
    ) {
      throw data("Ongeldige groep of bedrijf", { status: 400 })
    }

    // Continue after a failure, so that one farm with a conflicting period does not block the rest
    const failures: string[] = []
    async function apply(change: () => Promise<void>) {
      try {
        await change()
      } catch (error) {
        const message = getFarmGroupErrorMessage(error)
        if (!message) {
          throw error
        }
        failures.push(message)
      }
    }
    for (const b_id_group of addGroupIds) {
      for (const b_id_farm of farmIds) {
        await apply(async () => {
          await addFarmToGroup(
            fdm,
            session.principal_id,
            b_id_group,
            b_id_farm,
            b_group_joined,
            b_group_leaved,
          )
        })
      }
    }
    for (const b_id_group of removeGroupIds) {
      for (const b_id_farm of farmIds) {
        await apply(() =>
          removeFarmFromGroup(fdm, session.principal_id, b_id_group, b_id_farm, b_group_leaved),
        )
      }
    }
    if (failures.length > 0) {
      return dataWithError(null, {
        message: `${failures.length} wijziging(en) zijn niet gelukt: ${failures[0]}`,
      })
    }
    return dataWithSuccess(null, { message: "De groepen zijn bijgewerkt." })
  } catch (error) {
    return handleActionError(error)
  }
}

export default function OrganizationFarmsPage() {
  const { data, organization, groups, defaultJoined } = useLoaderData<typeof loader>()
  return (
    <main>
      <FarmTitle
        title={`Bedrijven met toegang door ${organization.name}`}
        description="Klik op een bedrijfsnaam voor meer informatie."
        action={{
          label: "Terug naar overzicht",
          to: `/organization/${organization.slug}`,
        }}
        rightNode={
          <Button variant="outline" asChild>
            <NavLink to={`/organization/${organization.slug}/groups`}>Groepen beheren</NavLink>
          </Button>
        }
      />
      <FarmContent>
        {data.length > 0 ? (
          <div className="flex flex-col space-y-8 pb-10 lg:flex-row lg:space-y-0 lg:space-x-12">
            <DataTable
              columns={columns}
              data={data}
              groups={groups}
              organizationSlug={organization.slug}
              defaultJoined={defaultJoined}
            />
          </div>
        ) : (
          <NoFarmsMessage
            action={{
              label: "Naar dashboard",
              to: `/organization/${organization.slug}`,
            }}
          />
        )}
      </FarmContent>
    </main>
  )
}
