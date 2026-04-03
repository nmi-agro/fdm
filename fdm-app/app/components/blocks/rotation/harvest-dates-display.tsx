import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import React from "react"
import { Link } from "react-router-dom"
import { useActiveTableFormStore } from "@/app/store/active-table-form"
import { Button } from "~/components/ui/button"
import type { FieldRow, RotationExtended } from "./columns"

type HarvestDatesDisplayProps = {
    row: RotationExtended
}

type HarvestRecordItem = {
    id: string
    dates: Date[]
    harvests: FieldRow["harvests"]
}
type HarvestRecordDisplayProps = {
    record: HarvestRecordItem
}

function compareDates(a: Date | null, b: Date | null) {
    return a && b ? a.getTime() - b.getTime() : !a ? 1 : -1
}

function groupAndOrderHarvests(row: RotationExtended) {
    const fields = row.type === "field" ? [row] : row.fields

    const grouped: FieldRow["harvests"][] = []

    for (const field of fields) {
        while (grouped.length < field.harvests.length) {
            grouped.push([])
        }

        for (let i = 0; i < field.harvests.length; i++) {
            grouped[i].push(field.harvests[i])
        }
    }

    for (const group of grouped) {
        group.sort((a, b) =>
            compareDates(a.b_lu_harvest_date, b.b_lu_harvest_date),
        )
    }

    return grouped
        .map((group) => ({
            id: "",
            dates: group
                .map((harvest) => harvest.b_lu_harvest_date)
                .filter((date) => date !== null),
            harvests: group,
        }))
        .sort((a, b) =>
            compareDates(
                a.dates.length > 0 ? a.dates[0] : null,
                b.dates.length > 0 ? b.dates[0] : null,
            ),
        )
        .map((a, i) => ({ ...a, id: i.toString() }))
}

/** Used if the cultivation is harvestable once so there is a mistake somewhere */
function combineRecords(records: HarvestRecordItem[]): HarvestRecordItem {
    const timestamps = [
        ...new Set(
            records.flatMap((record) =>
                record.dates.map((date) => date.getTime()),
            ),
        ),
    ]
    timestamps.sort((a, b) => a - b)
    return {
        id: records[0].id,
        dates: timestamps.map((timestamp) => new Date(timestamp)),
        harvests: records.flatMap((record) => record.harvests),
    }
}

function formatDateRange(dates: Date[]) {
    if (dates.length === 0) return ""
    const firstDate = dates[0]
    const lastDate = dates[dates.length - 1]
    return firstDate.getTime() === lastDate.getTime()
        ? `${format(firstDate, "PP", { locale: nl })}`
        : `${format(firstDate, "PP", { locale: nl })} - ${format(lastDate, "PP", { locale: nl })}`
}
function HarvestDatesDisplayButton({
    record,
    children,
}: HarvestRecordDisplayProps & { children: React.ReactNode }) {
    const setActiveForm = useActiveTableFormStore(
        (store) => store.setActiveForm,
    )
    const formId = `harvest_${record.id}`
    return (
        <Button
            asChild
            variant="link"
            className="text-muted-foreground whitespace-nowrap"
            onClick={() => setActiveForm(formId)}
        >
            <Link
                to={`./modify_harvest?harvestingIds=${encodeURIComponent(record.harvests.map((harvest) => harvest.b_id_harvesting).join(","))}`}
            >
                {children}
            </Link>
        </Button>
    )
}

export const HarvestDatesDisplay: React.FC<HarvestDatesDisplayProps> = ({
    row,
}) => {
    const formattedHarvestDates = React.useMemo(() => {
        const harvestsByOrder = groupAndOrderHarvests(row)

        if (harvestsByOrder.length === 1) {
            return (
                <HarvestDatesDisplayButton record={harvestsByOrder[0]}>
                    {formatDateRange(harvestsByOrder[0].dates)}
                </HarvestDatesDisplayButton>
            )
        }

        if (harvestsByOrder.length > 1) {
            if (row.b_lu_harvestable === "once") {
                const combined = combineRecords(harvestsByOrder)
                return (
                    <HarvestDatesDisplayButton record={combined}>
                        {formatDateRange(combined.dates)}
                    </HarvestDatesDisplayButton>
                )
            }

            return (
                <div className="flex items-start flex-col space-y-2">
                    {harvestsByOrder.map((record, idx) => {
                        return (
                            <HarvestDatesDisplayButton
                                key={record.id}
                                record={record}
                            >
                                {`${idx + 1}e ${row.b_lu_croprotation === "grass" ? "snede" : "oogst"}:`}
                                <br />
                                {formatDateRange(record.dates)}
                            </HarvestDatesDisplayButton>
                        )
                    })}
                </div>
            )
        }
        return null // Should not happen
    }, [row, row.type, row.fields, row.b_lu_harvestable, row.b_lu_croprotation])

    return formattedHarvestDates
}
