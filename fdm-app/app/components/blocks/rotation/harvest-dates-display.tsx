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

type HarvestRecord = Record<string, HarvestRecordItem>
type HarvestRecordItem = {
    id: string
    dates: Date[]
    harvests: FieldRow["harvests"]
}
type HarvestRecordDisplayProps = {
    record: HarvestRecordItem
}

function mapByOrder(record: HarvestRecord, fieldRow: FieldRow) {
    fieldRow.harvests.forEach((harvest, i) => {
        if (!harvest.b_lu_harvest_date) return
        const key = i
        record[key] ??= {
            id: `${harvest.b_lu}_${key}`,
            dates: [],
            harvests: [],
        }
        record[key].harvests.push(harvest)
        record[key].dates.push(harvest.b_lu_harvest_date)
    })
}

function groupAndOrderHarvests(row: RotationExtended) {
    const record: HarvestRecord = {}

    if (row.type === "crop") {
        row.fields.forEach((fieldRow) => {
            mapByOrder(record, fieldRow)
        })
    } else {
        mapByOrder(record, row)
    }

    const entries = Object.entries(record).map(
        ([idx, reduced]) =>
            [Number.parseFloat(idx), reduced] as [number, typeof reduced],
    )
    entries.sort((a, b) => a[0] - b[0])
    // Harvests with no date get filtered out in the mapping function
    entries.forEach((ent) => {
        ent[1].harvests.sort(
            (a, b) =>
                (a.b_lu_harvest_date as Date).getTime() -
                (b.b_lu_harvest_date as Date).getTime(),
        )
        ent[1].dates.sort((a, b) => a.getTime() - b.getTime())
    })
    return entries.map((ent) => ent[1])
}

function combineRecords(records: HarvestRecordItem[]): HarvestRecordItem {
    const timestamps = [
        ...new Set(
            records.flatMap((record) =>
                record.dates.map((date) => date.getTime()),
            ),
        ),
    ]
    timestamps.sort()
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
