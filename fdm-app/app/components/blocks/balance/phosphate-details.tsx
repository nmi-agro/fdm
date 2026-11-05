import type { PhosphateBalanceField, PhosphateFieldInput } from "@nmi-agro/fdm-calculator"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { NavLink, useParams } from "react-router"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { useCalendarStore } from "~/store/calendar"
import { formatNumberNl, PHOSPHATE_UNIT } from "./phosphate-format"

type Item = { id: string; value: number }

/** Dutch label of the leaching risk class (PSD relative to the field threshold). */
const LEACHING_RISK_LABELS = {
  low: "verzadiging onder de grens",
  medium: "verzadiging boven de grens",
  high: "verzadiging ruim boven de grens",
  unknown: "verzadiging onbekend",
} as const

/**
 * Accordion with the terms of the phosphate balance of a field: supply per fertilizer type and
 * application, mineralisation and deposition, removal per harvest and per cultivation whose crop
 * residues are removed, and the leaching (not part of the balance).
 *
 * @param balanceData - The phosphate balance of the field.
 * @param fieldInput - The input of the field (for names and dates).
 */
export function PhosphateBalanceDetails({
  balanceData,
  fieldInput,
}: {
  balanceData: PhosphateBalanceField
  fieldInput: PhosphateFieldInput
}) {
  const calendar = useCalendarStore((state) => state.calendar)
  const { b_id_farm } = useParams()
  const b_id = fieldInput.field.b_id
  const { fertilizers } = balanceData.supply
  const fertilizerHref = `/farm/${b_id_farm}/${calendar}/field/${b_id}/fertilizer`
  const cultivationHref = (b_lu: string) =>
    `/farm/${b_id_farm}/${calendar}/field/${b_id}/cultivation/${b_lu}`

  const renderApplications = (items: Item[]) => (
    <ul className="ml-6 list-outside list-disc space-y-1">
      {items.map((item) => {
        if (item.value === 0) return null
        const application = fieldInput.fertilizerApplications.find((a) => a.p_app_id === item.id)
        if (!application) return null
        return (
          <li key={item.id} className="text-muted-foreground text-sm hover:underline">
            <NavLink to={fertilizerHref}>
              {application.p_name_nl ?? "Meststof"} op{" "}
              {format(application.p_app_date, "PP", { locale: nl })}: {formatNumberNl(item.value)}{" "}
              {PHOSPHATE_UNIT}
            </NavLink>
          </li>
        )
      })}
    </ul>
  )

  const renderHarvests = (items: Item[]) => (
    <ul className="ml-6 list-outside list-disc space-y-1">
      {items.map((item) => {
        const harvest = fieldInput.harvests.find((h) => h.b_id_harvesting === item.id)
        const cultivation = harvest
          ? fieldInput.cultivations.find((c) => c.b_lu === harvest.b_lu)
          : undefined
        if (!harvest || !cultivation) return null
        return (
          <li key={item.id} className="text-muted-foreground text-sm hover:underline">
            <NavLink to={cultivationHref(cultivation.b_lu)}>
              {cultivation.b_lu_name ?? "Gewas"}
              {harvest.b_lu_harvest_date
                ? `, oogst op ${format(harvest.b_lu_harvest_date, "PP", { locale: nl })}`
                : ""}
              : {formatNumberNl(item.value)} {PHOSPHATE_UNIT}
            </NavLink>
          </li>
        )
      })}
    </ul>
  )

  const renderResidues = (items: Item[]) => (
    <ul className="ml-6 list-outside list-disc space-y-1">
      {items
        .filter((item) => item.value !== 0)
        .map((item) => {
          const cultivation = fieldInput.cultivations.find((c) => c.b_lu === item.id)
          if (!cultivation) return null
          return (
            <li key={item.id} className="text-muted-foreground text-sm hover:underline">
              <NavLink to={cultivationHref(cultivation.b_lu)}>
                {cultivation.b_lu_name ?? "Gewas"}: {formatNumberNl(item.value)} {PHOSPHATE_UNIT}
              </NavLink>
            </li>
          )
        })}
    </ul>
  )

  const { harvests, residues } = balanceData.removal
  const { mineralization, deposition } = balanceData.supply
  const { leaching } = balanceData
  const typeTotals = (
    [
      ["mineral", "Kunstmest"],
      ["manure", "Dierlijke mest"],
      ["compost", "Compost"],
      ["other", "Overige meststoffen"],
    ] as const
  ).filter(([type]) => fertilizers[type].total !== 0)
  const rowClass = "flex border-b py-4 text-sm font-medium"

  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value="supply">
        <AccordionTrigger>
          Aanvoer (Totaal): {formatNumberNl(balanceData.supply.total)} {PHOSPHATE_UNIT}
        </AccordionTrigger>
        <AccordionContent>
          <Accordion type="multiple" className="ml-4">
            {typeTotals.length > 0 ? (
              typeTotals.map(([type, label]) => (
                <AccordionItem key={type} value={`supply.fertilizers.${type}`}>
                  <AccordionTrigger>
                    {label}: {formatNumberNl(fertilizers[type].total)} {PHOSPHATE_UNIT}
                  </AccordionTrigger>
                  <AccordionContent>
                    {renderApplications(fertilizers[type].applications)}
                  </AccordionContent>
                </AccordionItem>
              ))
            ) : (
              <p className={rowClass}>Geen bemesting met fosfaat.</p>
            )}
            <p className={rowClass}>
              Mineralisatie
              {mineralization.track === "peat" ? " (veen)" : " (organische stof)"}:{" "}
              {formatNumberNl(mineralization.total)} {PHOSPHATE_UNIT}
            </p>
            <p className={rowClass}>
              Depositie: {formatNumberNl(deposition.total, 1)} {PHOSPHATE_UNIT}
            </p>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="removal">
        <AccordionTrigger>
          Afvoer (Totaal): {formatNumberNl(balanceData.removal.total)} {PHOSPHATE_UNIT}
        </AccordionTrigger>
        <AccordionContent>
          <Accordion type="multiple" className="ml-4">
            <AccordionItem value="removal.harvests">
              <AccordionTrigger>
                Oogst: {formatNumberNl(harvests.total)} {PHOSPHATE_UNIT}
              </AccordionTrigger>
              <AccordionContent>
                {harvests.harvests.length > 0 ? (
                  renderHarvests(harvests.harvests)
                ) : (
                  <p className="text-muted-foreground text-sm">Geen oogsten in dit jaar.</p>
                )}
              </AccordionContent>
            </AccordionItem>
            {residues.total !== 0 ? (
              <AccordionItem value="removal.residues">
                <AccordionTrigger>
                  Afgevoerde gewasresten: {formatNumberNl(residues.total)} {PHOSPHATE_UNIT}
                </AccordionTrigger>
                <AccordionContent>{renderResidues(residues.cultivations)}</AccordionContent>
              </AccordionItem>
            ) : null}
          </Accordion>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="leaching">
        <AccordionTrigger>
          Uitspoeling (niet in de balans): {formatNumberNl(leaching.total, 1)} {PHOSPHATE_UNIT}
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground ml-4 text-sm">
            {leaching.total === 0
              ? "Geen overschot, dus geen extra uitspoeling geschat."
              : `Overschot × ${formatNumberNl(leaching.factor, 3)} (${LEACHING_RISK_LABELS[leaching.risk]}: ${formatNumberNl(leaching.fraction, 2)}; grondwater: × ${formatNumberNl(leaching.groundwater_factor, 2)}).`}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
