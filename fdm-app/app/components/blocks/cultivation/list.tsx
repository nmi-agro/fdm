import { format } from "date-fns/format"
import { NavLink } from "react-router"
import type { Cultivation } from "./types"

interface Harvest {
  b_lu: string
  b_lu_harvest_date: Date | null
}

export function CultivationList({
  cultivations,
  harvests,
}: {
  cultivations: Cultivation[]
  harvests: Harvest[]
}) {
  const formatCultivationDate = (value: Date | null) =>
    value ? format(new Date(value), "yyyy-MM-dd") : "Onbekend"

  return (
    <ul>
      <li key={"header"}>
        <div className="grid grid-cols-3 items-center px-4">
          <div className="col-span-1">
            <p className="hidden text-sm leading-none font-medium">Gewas</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Zaaidatum</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Einddatum</p>
          </div>
        </div>
      </li>
      {cultivations.map((cultivation) => {
        const numHarvests = harvests.filter((x) => x.b_lu === cultivation.b_lu).length
        const harvestText =
          numHarvests === 0
            ? "geen oogst"
            : numHarvests === 1
              ? "1 oogst"
              : `${numHarvests} oogsten`
        return (
          <li key={cultivation.b_lu}>
            <NavLink
              to={`./${cultivation.b_lu}`}
              className={({ isActive }) =>
                `block rounded-lg p-4 ${
                  isActive
                    ? "bg-gray-100 dark:bg-gray-800"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`
              }
            >
              <div className="grid grid-cols-3 items-center gap-1">
                <div className="col-span-1">
                  <p className="text-sm leading-none font-medium break-all">
                    {cultivation.b_lu_name}
                  </p>
                  <p className="text-muted-foreground text-sm">{harvestText}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm leading-none">
                    {formatCultivationDate(cultivation.b_lu_start)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm leading-none">
                    {cultivation.b_lu_end
                      ? formatCultivationDate(cultivation.b_lu_end)
                      : "Nog niet beëindigd"}
                  </p>
                </div>
              </div>
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}
