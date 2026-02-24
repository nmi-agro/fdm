import type {
    FieldInput,
    OrganicMatterBalanceNumeric,
    OrganicMatterDegradationNumeric,
    OrganicMatterSupplyCultivationsNumeric,
    OrganicMatterSupplyFertilizersNumeric,
    OrganicMatterSupplyNumeric,
    OrganicMatterSupplyResiduesNumeric,
} from "@nmi-agro/fdm-calculator"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import type React from "react"
import { NavLink, useParams } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "~/components/ui/accordion"

interface OrganicMatterBalanceDetailsProps {
    balanceData: OrganicMatterBalanceNumeric
    fieldInput: FieldInput
}

const OrganicMatterBalanceDetails: React.FC<
    OrganicMatterBalanceDetailsProps
> = ({ balanceData, fieldInput }) => {
    const calendar = useCalendarStore((state) => state.calendar)
    const { farmId } = useParams()

    const renderFertilizerApplications = (
        applications: {
            total: number
            applications: Array<{ id: string; value: number }>
        },
        fieldInput: FieldInput,
        title: string,
        sectionKey: string,
    ) => {
        if (applications.applications.length === 0) return null
        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    {title} (Totaal): {applications.total} kg EOM / ha
                </AccordionTrigger>
                <AccordionContent>
                    <ul className="ml-6 list-disc list-outside space-y-1">
                        {applications.applications.map(
                            (app: { id: string; value: number }) => {
                                const application =
                                    fieldInput.fertilizerApplications.find(
                                        (fa: { p_app_id: string }) =>
                                            fa.p_app_id === app.id,
                                    )
                                if (
                                    !application ||
                                    !application.p_name_nl ||
                                    !application.p_app_date
                                ) {
                                    return null
                                }
                                return (
                                    <li
                                        key={app.id}
                                        className="text-sm text-muted-foreground hover:underline"
                                    >
                                        <NavLink
                                            to={`/farm/${farmId}/${calendar}/field/${fieldInput.field.b_id}/fertilizer`}
                                        >
                                            {application.p_name_nl} op{" "}
                                            {format(
                                                application.p_app_date,
                                                "PP",
                                                { locale: nl },
                                            )}
                                            : {app.value} kg EOM / ha
                                        </NavLink>
                                    </li>
                                )
                            },
                        )}
                    </ul>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderFertilizersSupply = (
        fertilizers: OrganicMatterSupplyFertilizersNumeric,
        fieldInput: FieldInput,
    ) => {
        return (
            <AccordionItem value="supply.fertilizers">
                <AccordionTrigger>
                    Bemesting (Totaal): {fertilizers.total} kg EOM / ha
                </AccordionTrigger>
                <AccordionContent>
                    <Accordion type="multiple" className="ml-4">
                        {renderFertilizerApplications(
                            fertilizers.manure,
                            fieldInput,
                            "Mest",
                            "supply.fertilizers.manure",
                        )}
                        {renderFertilizerApplications(
                            fertilizers.compost,
                            fieldInput,
                            "Compost",
                            "supply.fertilizers.compost",
                        )}
                        {renderFertilizerApplications(
                            fertilizers.other,
                            fieldInput,
                            "Overig",
                            "supply.fertilizers.other",
                        )}
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderCultivationsList = (
        items: Array<{ id: string; value: number }>,
        fieldInput: FieldInput,
        unit: string,
    ) => {
        return (
            <ul className="ml-6 list-disc list-outside space-y-1">
                {items.map((item) => {
                    if (item.value === 0) return null
                    const cultivation = fieldInput.cultivations.find(
                        (c: { b_lu: string }) => c.b_lu === item.id,
                    )
                    if (!cultivation) return null
                    return (
                        <NavLink
                            to={`../../${calendar}/field/${fieldInput.field.b_id}/cultivation/${item.id}`}
                            key={item.id}
                        >
                            <li className="text-sm text-muted-foreground hover:underline">
                                {cultivation.b_lu_name}: {item.value} {unit}
                            </li>
                        </NavLink>
                    )
                })}
            </ul>
        )
    }

    const renderCultivationsSupply = (
        cultivations: OrganicMatterSupplyCultivationsNumeric,
        fieldInput: FieldInput,
    ) => {
        if (cultivations.cultivations.length === 0) return null
        return (
            <AccordionItem value="supply.cultivations">
                <AccordionTrigger>
                    Gewassen (Totaal): {cultivations.total} kg EOM / ha
                </AccordionTrigger>
                <AccordionContent>
                    {renderCultivationsList(
                        cultivations.cultivations,
                        fieldInput,
                        "kg EOM / ha",
                    )}
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderResiduesSupply = (
        residues: OrganicMatterSupplyResiduesNumeric,
        fieldInput: FieldInput,
    ) => {
        if (residues.cultivations.length === 0) return null
        return (
            <AccordionItem value="supply.residues">
                <AccordionTrigger>
                    Gewasresten (Totaal): {residues.total} kg EOM / ha
                </AccordionTrigger>
                <AccordionContent>
                    {renderCultivationsList(
                        residues.cultivations,
                        fieldInput,
                        "kg EOM / ha",
                    )}
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderSupply = (
        supply: OrganicMatterSupplyNumeric,
        fieldInput: FieldInput,
    ) => {
        return (
            <AccordionItem value="supply">
                <AccordionTrigger>
                    Aanvoer (Totaal): {supply.total} kg EOM / ha
                </AccordionTrigger>
                <AccordionContent>
                    <Accordion type="multiple" className="ml-4">
                        {renderFertilizersSupply(
                            supply.fertilizers,
                            fieldInput,
                        )}
                        {renderCultivationsSupply(
                            supply.cultivations,
                            fieldInput,
                        )}
                        {renderResiduesSupply(supply.residues, fieldInput)}
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderDegradation = (
        degradation: OrganicMatterDegradationNumeric,
    ) => {
        return (
            <AccordionItem value="degradation">
                <p className="flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all text-left">
                    Afbraak: {degradation.total} kg OM / ha
                </p>
            </AccordionItem>
        )
    }

    return (
        <div>
            <Accordion type="multiple" className="w-full">
                {renderSupply(balanceData.supply, fieldInput)}
                {renderDegradation(balanceData.degradation)}
            </Accordion>
        </div>
    )
}

export default OrganicMatterBalanceDetails
