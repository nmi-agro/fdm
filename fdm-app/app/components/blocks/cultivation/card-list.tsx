import { Sprout } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "~/components/ui/empty"
import { CultivationAddFormDialog } from "./form-add"
import { CultivationList } from "./list"
import type { Cultivation, CultivationOption } from "./types"

interface Harvest {
    b_lu: string
    b_lu_harvest_date: Date
    b_lu_yield: number
    b_lu_n_harvestable: number
}

export function CultivationListCard({
    cultivationsCatalogueOptions,
    cultivations,
    harvests,
    editable = true,
}: {
    cultivationsCatalogueOptions: CultivationOption[]
    cultivations: Cultivation[]
    harvests: Harvest[]
    editable?: boolean
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-semibold tracking-tight text-gray-900">
                    Gewassen
                </CardTitle>
                {cultivations.length !== 0 && editable ? (
                    <CultivationAddFormDialog
                        options={cultivationsCatalogueOptions}
                    />
                ) : null}
            </CardHeader>
            <CardContent>
                {cultivations.length !== 0 ? (
                    <CultivationList
                        cultivations={cultivations}
                        harvests={harvests}
                    />
                ) : (
                    <Empty className="border-none">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Sprout />
                            </EmptyMedia>
                            <EmptyTitle>
                                Dit perceel heeft nog geen gewas voor dit jaar
                            </EmptyTitle>
                            <EmptyDescription>
                                Voeg een gewas toe voor dit perceel om gegevens
                                zoals, zaai- en oogstdatum en opbrengst bij te
                                houden.
                            </EmptyDescription>
                        </EmptyHeader>
                        {editable && (
                            <EmptyContent>
                                <CultivationAddFormDialog
                                    options={cultivationsCatalogueOptions}
                                />
                            </EmptyContent>
                        )}
                    </Empty>
                )}
            </CardContent>
        </Card>
    )
}
