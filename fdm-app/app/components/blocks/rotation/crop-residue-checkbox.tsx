import type { CellContext } from "@tanstack/react-table"
import { useFetcher } from "react-router"
import { Checkbox } from "~/components/ui/checkbox"
import { Spinner } from "~/components/ui/spinner"
import type { CropRow, FieldRow, RotationExtended } from "./columns"

export function CropResidueCheckbox({
    cell,
    row,
}: CellContext<RotationExtended, unknown>) {
    const fetcher = useFetcher()

    const fields =
        row.original.type === "crop"
            ? (row.subRows ?? []).map(
                  (fieldRow) => fieldRow.original as FieldRow,
              )
            : [row.original]

    const submit = (value: boolean) => {
        const fieldIds = fields
            .map((field) => encodeURIComponent(field.b_id))
            .join(",")
        const cultivationIds = encodeURIComponent(
            ((row.getParentRow()?.original ?? row.original) as CropRow)
                .b_lu_catalogue,
        )
        return fetcher.submit(
            {
                m_cropresidue: value,
            },
            {
                method: "POST",
                action: `?cultivationIds=${cultivationIds}&fieldIds=${fieldIds}`,
            },
        )
    }

    const inputId = `${cell.id}_checkbox`

    const m_cropresidue = fields.every((field) => field.m_cropresidue === "all")
        ? "all"
        : fields.every((field) => field.m_cropresidue === "none")
          ? "none"
          : "some"

    const checkedState = (
        {
            all: true,
            some: "indeterminate",
            none: false,
        } as const
    )[m_cropresidue]

    return fetcher.state !== "idle" ? (
        <Spinner />
    ) : (
        <div className="flex flex-row items-center gap-1 text-muted-foreground">
            {row.original.canModify ? (
                <Checkbox
                    id={inputId}
                    checked={checkedState}
                    onCheckedChange={(value) => submit(!!value)}
                />
            ) : (
                <Checkbox id={inputId} checked={checkedState} disabled={true} />
            )}
            <label htmlFor={inputId}>
                {" "}
                {
                    (
                        {
                            all: "Ja",
                            some: "Gedeeltelijk",
                            none: "Nee",
                        } as const
                    )[m_cropresidue]
                }
            </label>
        </div>
    )
}
