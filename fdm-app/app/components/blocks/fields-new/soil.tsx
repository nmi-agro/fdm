import type {
    CurrentSoilData,
    SoilParameterDescription,
} from "@nmi-agro/fdm-core"
import { FileUp, Info, Keyboard } from "lucide-react"
import { NavLink, useLocation, useParams } from "react-router"
import { SoilDataCards } from "~/components/blocks/soil/cards"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"

export function NewFieldSoilAnalysisBlock({
    b_id,
    currentSoilData,
    isEstimated,
    soilParameterDescription,
    isFarmCreateWizard,
}: NewFieldSoilAnalysisBlockProps) {
    const location = useLocation()
    const params = useParams()
    const { b_id_farm, calendar } = params

    const bulkUploadLink = isFarmCreateWizard
        ? `/farm/create/${b_id_farm}/${calendar}/soil-analysis/bulk`
        : `/farm/${b_id_farm}/soil-analysis/bulk`

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            Bodem
                            {isEstimated && (
                                <Badge
                                    variant="secondary"
                                    className="bg-orange-100 text-orange-800 hover:bg-orange-100 font-normal border-transparent"
                                >
                                    Schatting
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Bodemgegevens voor dit perceel.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {isEstimated && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground leading-snug">
                            <Info className="h-4 w-4 shrink-0" />
                            <p>
                                Voor een nauwkeuriger advies kun je al je
                                bodemanalyses (pdf) in één keer uploaden. We
                                proberen deze automatisch aan het juiste perceel
                                te koppelen, maar je kunt dit na het uploaden
                                ook zelf controleren en aanpassen.
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button asChild className="flex-1 sm:flex-none">
                            <NavLink to={bulkUploadLink}>
                                <FileUp className="mr-2 h-4 w-4" />
                                Bodemanalyses uploaden (pdf)
                            </NavLink>
                        </Button>
                        <Button
                            variant="outline"
                            asChild
                            className="flex-1 sm:flex-none"
                        >
                            <NavLink
                                to={`../${b_id}/soil/analysis${location.search}`}
                            >
                                <Keyboard className="mr-2 h-4 w-4" />
                                Handmatig invullen
                            </NavLink>
                        </Button>
                    </div>

                    <Separator />

                    <div className="">
                        <SoilDataCards
                            currentSoilData={currentSoilData}
                            soilParameterDescription={soilParameterDescription}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

type NewFieldSoilAnalysisBlockProps = {
    b_id: string
    currentSoilData: CurrentSoilData
    isEstimated?: boolean
    soilParameterDescription: SoilParameterDescription
    isFarmCreateWizard?: boolean
}
