import type { getFarms } from "@nmi-agro/fdm-core"
import { useRef } from "react"
import { useSearchParams } from "react-router"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog"

/**
 * Renders a button which, when clicked, shows a dialog where the user can change selection of farms included in balance calculation.
 *
 * - `farms` should be the complete list of farms that the user can select or ignore.
 * - `defaultSelectedFarmIds` should be coming from the loader data after validation, and is used to set the initial state of the checkboxes.
 *
 * The dialog will set the `farmIds` search param directly when the selection changes.
 *
 * @param param0 component props
 * @returns a React node
 */
export function FarmSelectDialog({
    farms,
    defaultSelectedFarmIds,
}: {
    farms: Awaited<ReturnType<typeof getFarms>>
    defaultSelectedFarmIds: string[]
}) {
    const formRef = useRef<HTMLFormElement | null>(null)
    const [, setSearchParams] = useSearchParams()

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">Wijzig selectie</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Wijzig selectie van bedrijven</DialogTitle>
                    <DialogDescription>
                        De geselecteerde bedrijven zijn uitgesloten in de
                        berekening.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} className="space-y-8">
                    {farms.map((farm) => {
                        const b_id_farm = farm.b_id_farm
                        const currentValue = defaultSelectedFarmIds.includes(
                            farm.b_id_farm,
                        )
                        return (
                            <div
                                key={farm.b_id_farm}
                                className="flex flex-row items-center gap-4"
                            >
                                <Checkbox
                                    name={b_id_farm}
                                    defaultChecked={!!currentValue}
                                />
                                {farm.b_name_farm ?? "Onbekend"}
                            </div>
                        )
                    })}
                </form>
                <DialogFooter>
                    <DialogClose
                        asChild
                        onClick={() => {
                            const form = formRef.current

                            const newlySelectedFarmIds: string[] = []
                            if (form) {
                                const formData = new FormData(form)
                                for (const [
                                    b_id_farm,
                                    selected,
                                ] of formData.entries()) {
                                    if (selected) {
                                        newlySelectedFarmIds.push(b_id_farm)
                                    }
                                }
                            }
                            const sortedDefaultSelectedFarmIds = [
                                ...defaultSelectedFarmIds,
                            ].sort()
                            newlySelectedFarmIds.sort()
                            if (
                                sortedDefaultSelectedFarmIds.length !==
                                    newlySelectedFarmIds.length ||
                                newlySelectedFarmIds.some(
                                    (selected_id, index) =>
                                        selected_id !==
                                        sortedDefaultSelectedFarmIds[index],
                                )
                            ) {
                                setSearchParams((searchParams) => {
                                    const newSearchParams = new URLSearchParams(
                                        searchParams,
                                    )
                                    if (newlySelectedFarmIds.length > 0) {
                                        newSearchParams.set(
                                            "farmIds",
                                            newlySelectedFarmIds.join(","),
                                        )
                                    } else {
                                        newSearchParams.delete("farmIds")
                                    }
                                    return newSearchParams
                                })
                            }
                        }}
                    >
                        <Button variant="outline">Opslaan</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
