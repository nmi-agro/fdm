import type { CellContext } from "@tanstack/react-table"
import { ArrowUpRightFromSquare } from "lucide-react"
import { NavLink, useLocation, useParams } from "react-router-dom"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import type { RotationExtended } from "./columns"

export function NameCell({ row }: CellContext<RotationExtended, unknown>) {
    const original = row.original
    const params = useParams()
    const location = useLocation()
    return original.type === "crop" ? (
        <Badge
            style={{
                backgroundColor: getCultivationColor(
                    original.b_lu_croprotation,
                ),
            }}
            className={"text-white"}
            variant="default"
        >
            {original.b_lu_name}
        </Badge>
    ) : (
        <NavLink
            to={
                location.pathname.includes("/farm/create")
                    ? `/farm/create/${params.b_id_farm}/${params.calendar}/fields/${original.b_id}`
                    : `/farm/${params.b_id_farm}/${params.calendar}/field/${original.b_id}`
            }
            className="group flex items-center hover:underline w-fit ps-4"
        >
            {original.b_name}
            <ArrowUpRightFromSquare className="ml-2 h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </NavLink>
    )
}
