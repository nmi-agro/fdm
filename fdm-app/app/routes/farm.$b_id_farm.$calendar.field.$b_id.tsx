import {
    checkPermission,
    getFarms,
    getField,
    getFields,
} from "@nmi-agro/fdm-core"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    Outlet,
    redirect,
    useLoaderData,
    useLocation,
} from "react-router"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { HeaderField } from "~/components/blocks/header/field"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { useCalendarStore } from "~/store/calendar"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Perceel | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk en bewerk de gegevens van je perceel.",
        },
    ]
}

/**
 * Loads data required to render the farm field index page.
 *
 * This function verifies that both a farm ID and a field ID are provided in the route parameters, retrieving the user session before fetching farms and fields associated with the user's principal ID.
 * It constructs selectable options for farms and fields (with field areas rounded to one decimal place), ensures field options are sorted alphabetically, and retrieves detailed information about the specified field.
 * Additionally, it builds sidebar navigation items for the page.
 *
 * @returns An object containing:
 *  - b_id_farm: The farm identifier.
 *  - farmOptions: An array of valid farm options.
 *  - fieldOptions: A sorted array of valid field options, each including an identifier, name, and area.
 *  - field: Detailed information about the field.
 *  - b_id: The field identifier.
 *  - sidebarPageItems: An array of navigation items for the sidebar.
 *  - user: Data of the authenticated user.
 *
 * @throws {Response} If either the farm ID or field ID is missing, with a status of 400.
 * @throws {Error} If the retrieved farm or field data does not match the expected structure.
 * @throws The error processed by {@link handleLoaderError} for any other issues encountered.
 */
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

        // Get timeframe from calendar store
        const calendar = getCalendar(params)
        const timeframe = getTimeframe(params)

        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, session.principal_id)

        // Redirect to farms overview if user has no farm
        if (farms.length === 0) {
            return redirect("farm")
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

        // Get the fields to be selected
        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )
        const fieldOptions = fields.map((field) => {
            if (!field?.b_id || !field?.b_name) {
                throw new Error("Invalid field data structure")
            }
            return {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: Math.round(field.b_area * 10) / 10,
            }
        })

        // Sort fields by name alphabetically
        fieldOptions.sort((a, b) => a.b_name.localeCompare(b.b_name))

        // Get the generral information of the field
        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("Unable to find field", {
                status: 404,
                statusText: "Unable to find field",
            })
        }

        // Create the items for sidebar page
        const sidebarPageItems = [
            {
                to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/overview`,
                title: "Overzicht",
            },
            {
                to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/cultivation`,
                title: "Gewassen",
            },
            {
                to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/fertilizer`,
                title: "Bemesting",
            },
            {
                to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/soil`,
                title: "Bodem",
            },
            {
                to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/atlas`,
                title: "Kaart",
            },
        ]

        const fieldWritePermission = await checkPermission(
            fdm,
            "field",
            "write",
            b_id,
            session.principal_id,
            new URL(request.url).pathname,
            false,
        )

        if (fieldWritePermission) {
            sidebarPageItems.push({
                to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/delete`,
                title: "Verwijderen",
            })
        }

        // Return user information from loader
        return {
            b_id_farm: b_id_farm,
            farmOptions: farmOptions,
            fieldOptions: fieldOptions,
            field: field,
            b_id: b_id,
            sidebarPageItems: sidebarPageItems,
            user: session.user,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the farm field index page.
 *
 * This component uses loader data to display a sidebar with navigation controls and a header
 * featuring farm and field options. It further presents a main section with the field’s title,
 * a descriptive message, and an outlet for nested route content.
 *
 * @returns A React component representing the farm field index view.
 */
export default function FarmFieldIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const calendar = useCalendarStore((state) => state.calendar)
    const location = useLocation()

    if (location.pathname.includes("fertilizer/manage")) return <Outlet />
    return (
        <SidebarInset>
            <Header
                action={{
                    to: `/farm/${loaderData.b_id_farm}/${calendar}/field/`,
                    label: "Terug naar percelen",
                    disabled: false,
                }}
            >
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
                <HeaderField
                    b_id_farm={loaderData.b_id_farm}
                    fieldOptions={loaderData.fieldOptions}
                    b_id={loaderData.b_id}
                />
            </Header>
            <main>
                <FarmTitle
                    title={loaderData.field?.b_name}
                    description={"Beheer hier de gegevens van dit perceel"}
                />
                <FarmContent sidebarItems={loaderData.sidebarPageItems}>
                    <Outlet />
                </FarmContent>
            </main>
        </SidebarInset>
    )
}
