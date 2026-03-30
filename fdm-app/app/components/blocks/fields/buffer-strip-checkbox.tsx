import type { CellContext } from "@tanstack/react-table"
import { useFetcher } from "react-router"
import { Checkbox } from "~/components/ui/checkbox"
import { Spinner } from "~/components/ui/spinner"
import type { FieldExtended } from "./columns"

export function BufferStripCheckbox({
    row,
}: CellContext<FieldExtended, unknown>) {
    const fetcher = useFetcher()

    const submit = (value: boolean) => {
        return fetcher.submit(
            {
                b_id: row.original.b_id,
                b_bufferstrip: value,
            },
            {
                method: "POST",
            },
        )
    }

    const inputId = `${row.original.b_id}_bufferstrip`

    return fetcher.state !== "idle" ? (
        <Spinner />
    ) : (
        <div className="flex items-center">
            <Checkbox
                id={inputId}
                checked={row.original.b_bufferstrip}
                onCheckedChange={(value) => submit(!!value)}
                disabled={!row.original.has_write_permission}
            />
        </div>
    )
}
