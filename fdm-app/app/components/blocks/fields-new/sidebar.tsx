import { ArrowLeft, CheckCircle2, Info } from "lucide-react"
import { useMemo } from "react"
import { NavLink, useLocation } from "react-router"
import { useFieldFilterStore } from "@/app/store/field-filter"
import { FieldFilterToggle } from "../../custom/field-filter-toggle"
import { SidebarPage } from "../../custom/sidebar-page"
import { Button } from "../../ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "../../ui/card"

export function NewFieldsSidebar({
    fields,
    soilStatus,
    b_id_farm,
    calendar,
    isFarmCreateWizard,
}: NewFieldsSidebarProps) {
    const { showProductiveOnly } = useFieldFilterStore()
    const location = useLocation()

    const sidebarPageItems = useMemo(
        () =>
            fields
                .filter((field) =>
                    showProductiveOnly ? field.b_bufferstrip === false : true,
                )
                .slice()
                .sort((a, b) => (b.b_area ?? 0) - (a.b_area ?? 0)) // Sort by area in descending order
                .map((field) => {
                    const status = soilStatus?.[field.b_id]
                    return {
                        title: field.b_name,
                        to:
                            (isFarmCreateWizard ?? false)
                                ? `/farm/create/${b_id_farm}/${calendar}/fields/${field.b_id}`
                                : `/farm/${b_id_farm}/${calendar}/field/new/fields/${field.b_id}${location.search}`,
                        icon:
                            status === "measured" ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                                <Info className="h-4 w-4 text-orange-500" />
                            ),
                    }
                }),
        [
            fields,
            soilStatus,
            showProductiveOnly,
            b_id_farm,
            calendar,
            isFarmCreateWizard,
            location.search,
        ],
    )

    const measuredCount = useMemo(() => {
        if (!soilStatus) return 0
        return Object.values(soilStatus).filter((s) => s === "measured").length
    }, [soilStatus])

    return (
        <aside className="lg:w-1/5 gap-0">
            <Card>
                <CardHeader>
                    <CardTitle className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="space-y-1">
                            <p>Percelen</p>
                            <p className="text-xs font-normal text-muted-foreground">
                                {measuredCount} van {fields.length} met
                                bodemanalyse
                            </p>
                        </div>
                        <FieldFilterToggle />
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <SidebarPage items={sidebarPageItems} />
                </CardContent>
                <CardFooter className="flex flex-col items-center space-y-2 relative">
                    {/* <Separator /> */}
                    <Button variant={"link"} asChild>
                        <NavLink
                            to={
                                isFarmCreateWizard
                                    ? `/farm/create/${b_id_farm}/${calendar}/atlas`
                                    : `/farm/${b_id_farm}/${calendar}/field/new`
                            }
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Terug naar kaart
                        </NavLink>
                    </Button>
                </CardFooter>
            </Card>
        </aside>
    )
}

type NewFieldsSidebarProps = {
    fields: {
        b_id: string
        b_name: string
        b_area: number | null
        b_bufferstrip: boolean
    }[]
    soilStatus?: Record<string, "estimated" | "measured" | "missing">
    b_id_farm: string
    calendar: string
    isFarmCreateWizard: boolean
}
