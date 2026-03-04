import type {
    FieldInput,
    NitrogenBalanceFieldNumeric,
    NitrogenEmissionNumeric,
    NitrogenRemovalHarvestsNumeric,
    NitrogenRemovalNumeric,
    NitrogenRemovalResiduesNumeric,
    NitrogenSupplyFertilizersNumeric,
    NitrogenSupplyFixationNumeric,
    NitrogenSupplyMineralizationNumeric,
    NitrogenSupplyNumeric,
} from "@nmi-agro/fdm-calculator"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import type React from "react"
import { NavLink } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "~/components/ui/accordion"

interface NitrogenBalanceDetailsProps {
    balanceData: NitrogenBalanceFieldNumeric
    fieldInput: FieldInput
}

const NitrogenBalanceDetails: React.FC<NitrogenBalanceDetailsProps> = ({
    balanceData,
    fieldInput,
}) => {
    const calendar = useCalendarStore((state) => state.calendar)

    const renderSupply = (
        supply: NitrogenSupplyNumeric,
        fieldInput: FieldInput,
    ) => {
        const sectionKey = "supply"
        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    Aanvoer (Totaal): {supply.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <Accordion type="multiple" className="ml-4">
                        {/* Render Fertilizers */}
                        {renderFertilizersSupply(
                            supply.fertilizers,
                            fieldInput,
                        )}

                        {/* Render Fixation */}
                        {renderFixationSupply(supply.fixation, fieldInput)}

                        {/* Render Deposition */}
                        {renderDepositionSupply(supply.deposition)}

                        {/* Render Mineralization */}
                        {renderMineralizationSupply(supply.mineralisation)}
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderFertilizersSupply = (
        fertilizers: NitrogenSupplyFertilizersNumeric,
        fieldInput: FieldInput,
    ) => {
        const sectionKey = "supply.fertilizers"

        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    Bemesting (Totaal): {fertilizers.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <Accordion type="multiple" className="ml-4">
                        {/* Render Mineral Fertilizers */}
                        {renderFertilizerApplications(
                            fertilizers.mineral,
                            fieldInput,
                            "Minerale meststoffen",
                            "supply.fertilizers.mineral",
                        )}

                        {/* Render Manure */}
                        {renderFertilizerApplications(
                            fertilizers.manure,
                            fieldInput,
                            "Mest",
                            "supply.fertilizers.manure",
                        )}

                        {/* Render Compost */}
                        {renderFertilizerApplications(
                            fertilizers.compost,
                            fieldInput,
                            "Compost",
                            "supply.fertilizers.compost",
                        )}

                        {/* Render other fertilizers */}
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

    const renderFertilizerApplications = (
        applications: {
            total: number
            applications: Array<{ id: string; value: number }>
        },
        fieldInput: FieldInput,
        title: string,
        sectionKey: string,
    ) => {
        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    {title} (Totaal): {applications.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <ul className="ml-6 list-disc list-outside space-y-1">
                        {applications.applications.map(
                            (app: { id: string; value: number }) => {
                                if (app.value === 0) {
                                    return null
                                }
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
                                    console.error(
                                        `Application not found for id: ${app.id}`,
                                    )
                                    return null
                                }
                                return (
                                    <NavLink
                                        to={`../../${calendar}/field/${fieldInput.field.b_id}/fertilizer`}
                                        key={app.id}
                                    >
                                        <li className="text-sm text-muted-foreground hover:underline">
                                            {application.p_name_nl} op{" "}
                                            {format(
                                                application.p_app_date,
                                                "PP",
                                                { locale: nl },
                                            )}
                                            : {app.value} kg N / ha
                                        </li>
                                    </NavLink>
                                )
                            },
                        )}
                    </ul>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderFixationSupply = (
        fixation: NitrogenSupplyFixationNumeric,
        fieldInput: FieldInput,
    ) => {
        const sectionKey = "supply.fixation"

        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    Fixatie (Totaal): {fixation.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <ul className="ml-6 list-disc list-outside space-y-1">
                        {fixation.cultivations.map(
                            (cult: { id: string; value: number }) => {
                                if (cult.value === 0) {
                                    return null
                                }

                                const cultivation =
                                    fieldInput.cultivations.find(
                                        (cultivation: { b_lu: string }) =>
                                            cultivation.b_lu === cult.id,
                                    )
                                return cultivation ? (
                                    <NavLink
                                        to={`../../${calendar}/field/${fieldInput.field.b_id}/cultivation/${cultivation.b_lu}`}
                                        key={cult.id}
                                    >
                                        <li className="text-sm text-muted-foreground hover:underline">
                                            {cultivation.b_lu_name}:{" "}
                                            {cult.value} kg N / ha
                                        </li>
                                    </NavLink>
                                ) : null
                            },
                        )}
                    </ul>
                </AccordionContent>
            </AccordionItem>
        )
    }
    const renderDepositionSupply = (deposition: { total: number }) => {
        const sectionKey = "supply.deposition"

        return (
            <AccordionItem value={sectionKey}>
                <p className="flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all text-left">
                    Depositie: {deposition.total} kg N / ha
                </p>
                <AccordionContent />
            </AccordionItem>
        )
    }

    const renderMineralizationSupply = (
        mineralization: NitrogenSupplyMineralizationNumeric,
    ) => {
        const sectionKey = "supply.mineralization"

        return (
            <AccordionItem value={sectionKey}>
                <p className="flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all text-left">
                    Mineralisatie: {mineralization.total} kg N / ha
                </p>
            </AccordionItem>
        )
    }

    const renderRemoval = (
        removal: NitrogenRemovalNumeric,
        fieldInput: FieldInput,
    ) => {
        const sectionKey = "removal"

        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    Afvoer (Totaal): {removal.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <Accordion type="multiple" className="ml-4">
                        {/* Render Harvests */}
                        {renderHarvestsRemoval(removal.harvests, fieldInput)}

                        {/* Render Residues */}
                        {renderResiduesRemoval(removal.residues, fieldInput)}
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderHarvestsRemoval = (
        harvests: NitrogenRemovalHarvestsNumeric,
        fieldInput: FieldInput,
    ) => {
        const sectionKey = "removal.harvests"

        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    Oogsten (Totaal): {harvests.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <ul className="ml-6 list-disc list-outside space-y-1">
                        {harvests.harvests.map(
                            (harvest: { id: string; value: number }) => {
                                const harvestDetails = fieldInput.harvests.find(
                                    (item: { b_id_harvesting: string }) =>
                                        item.b_id_harvesting === harvest.id,
                                )
                                if (!harvestDetails) {
                                    console.error(
                                        `Harvest not found for id: ${harvest.id}`,
                                    )
                                    return null
                                }

                                const cultivationDetails =
                                    fieldInput.cultivations.find(
                                        (cultivation: { b_lu: string }) =>
                                            cultivation.b_lu ===
                                            harvestDetails.b_lu,
                                    )
                                if (!cultivationDetails) {
                                    console.error(
                                        `Cultivation not found for harvest: ${harvest.id}`,
                                    )
                                    return null
                                }

                                return (
                                    <NavLink
                                        to={`../../${calendar}/field/${fieldInput.field.b_id}/cultivation/${cultivationDetails.b_lu}/harvest/${harvest.id}`}
                                        key={harvest.id}
                                    >
                                        <li className="text-sm text-muted-foreground hover:underline">
                                            Oogst op{" "}
                                            {format(
                                                harvestDetails.b_lu_harvest_date,
                                                "PP",
                                                { locale: nl },
                                            )}
                                            : {harvest.value} kg N / ha
                                        </li>
                                    </NavLink>
                                )
                            },
                        )}
                    </ul>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderResiduesRemoval = (
        residues: NitrogenRemovalResiduesNumeric,
        fieldInput: FieldInput,
    ) => {
        const sectionKey = "removal.residues"

        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    Gewasresten (Totaal): {residues.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <ul className="ml-6 list-disc list-outside space-y-1">
                        {residues.cultivations.map(
                            (cult: { id: string; value: number }) => {
                                if (cult.value === 0) {
                                    return null
                                }

                                const cultivation =
                                    fieldInput.cultivations.find(
                                        (cultivation: { b_lu: string }) =>
                                            cultivation.b_lu === cult.id,
                                    )
                                return cultivation ? (
                                    <NavLink
                                        to={`../../${calendar}/field/${fieldInput.field.b_id}/cultivation/${cultivation.b_lu}`}
                                        key={cult.id}
                                    >
                                        <li className="text-sm text-muted-foreground hover:underline">
                                            {cultivation.b_lu_name}:{" "}
                                            {cult.value} kg N / ha
                                        </li>
                                    </NavLink>
                                ) : null
                            },
                        )}
                    </ul>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderAmmoniaEmissions = (
        ammonia: NitrogenEmissionNumeric["ammonia"],
        fieldInput: FieldInput,
    ) => {
        const sectionKey = "ammonia"

        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    Ammoniak (Totaal): {ammonia.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <Accordion type="multiple" className="ml-4">
                        {/* Render Fertilizers */}
                        {renderFertilizersEmission(
                            ammonia.fertilizers,
                            fieldInput,
                        )}

                        {/* Render Residues */}
                        {renderResiduesEmission(ammonia.residues, fieldInput)}
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderNitrateEmissions = (
        nitrate: NitrogenEmissionNumeric["nitrate"],
    ) => {
        const sectionKey = "nitraat"

        return (
            <AccordionItem value={sectionKey}>
                <p className="flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all text-left">
                    Nitraat: {nitrate.total} kg N / ha
                </p>
                <AccordionContent />
            </AccordionItem>
        )
    }

    const renderFertilizersEmission = (
        fertilizers: NitrogenEmissionNumeric["ammonia"]["fertilizers"],
        fieldInput: FieldInput,
    ) => {
        const sectionKey = "emission.ammonia.fertilizers"

        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    Bemesting (Totaal): {fertilizers.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <Accordion type="multiple" className="ml-4">
                        {/* Render Mineral Fertilizers */}
                        {renderFertilizerEmissions(
                            fertilizers.mineral,
                            fieldInput,
                            "Minerale meststoffen",
                            "emission.ammonia.fertilizers.mineral",
                        )}

                        {/* Render Manure */}
                        {renderFertilizerEmissions(
                            fertilizers.manure,
                            fieldInput,
                            "Mest",
                            "emission.ammonia.fertilizers.manure",
                        )}

                        {/* Render Compost */}
                        {renderFertilizerEmissions(
                            fertilizers.compost,
                            fieldInput,
                            "Compost",
                            "emission.ammonia.fertilizers.compost",
                        )}

                        {/* Render other fertilizers */}
                        {renderFertilizerEmissions(
                            fertilizers.other,
                            fieldInput,
                            "Overig",
                            "emission.ammonia.fertilizers.other",
                        )}
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderResiduesEmission = (
        residues: NitrogenEmissionNumeric["ammonia"]["residues"],
        fieldInput: FieldInput,
    ) => {
        const sectionKey = "emission.ammonia.residues"

        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    Gewasresten (Totaal): {residues.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <ul className="ml-6 list-disc list-outside space-y-1">
                        {residues.cultivations.map(
                            (cult: { id: string; value: number }) => {
                                if (cult.value === 0) {
                                    return null
                                }

                                const cultivation =
                                    fieldInput.cultivations.find(
                                        (cultivation: { b_lu: string }) =>
                                            cultivation.b_lu === cult.id,
                                    )
                                return cultivation ? (
                                    <NavLink
                                        to={`../../${calendar}/field/${fieldInput.field.b_id}/cultivation/${cultivation.b_lu}`}
                                        key={cult.id}
                                    >
                                        <li className="text-sm text-muted-foreground hover:underline">
                                            {cultivation.b_lu_name}:{" "}
                                            {cult.value} kg N / ha
                                        </li>
                                    </NavLink>
                                ) : null
                            },
                        )}
                    </ul>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderFertilizerEmissions = (
        applications: {
            total: number
            applications: Array<{ id: string; value: number }>
        },
        fieldInput: FieldInput,
        title: string,
        sectionKey: string,
    ) => {
        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    {title} (Totaal): {applications.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <ul className="ml-6 list-disc list-outside space-y-1">
                        {applications.applications.map(
                            (app: { id: string; value: number }) => {
                                if (app.value === 0) {
                                    return null
                                }
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
                                    console.error(
                                        `Application not found for id: ${app.id}`,
                                    )
                                    return null
                                }
                                return (
                                    <NavLink
                                        to={`../../${calendar}/field/${fieldInput.field.b_id}/fertilizer`}
                                        key={app.id}
                                    >
                                        <li className="text-sm text-muted-foreground hover:underline">
                                            {application.p_name_nl} op{" "}
                                            {format(
                                                application.p_app_date,
                                                "PP",
                                                { locale: nl },
                                            )}
                                            : {app.value} kg N / ha
                                        </li>
                                    </NavLink>
                                )
                            },
                        )}
                    </ul>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderEmission = (
        emission: NitrogenEmissionNumeric,
        fieldInput: FieldInput,
    ) => {
        const sectionKey = "emission"

        return (
            <AccordionItem value={sectionKey}>
                <AccordionTrigger>
                    Emissie (Totaal): {emission.total} kg N / ha
                </AccordionTrigger>
                <AccordionContent>
                    <Accordion type="multiple" className="ml-4">
                        {renderAmmoniaEmissions(emission.ammonia, fieldInput)}
                    </Accordion>
                    <Accordion type="multiple" className="ml-4">
                        {renderNitrateEmissions(emission.nitrate)}
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
        )
    }

    return (
        <div>
            <Accordion type="multiple" className="w-full">
                {renderSupply(balanceData.supply, fieldInput)}
                {renderRemoval(balanceData.removal, fieldInput)}
                {renderEmission(balanceData.emission, fieldInput)}
            </Accordion>
        </div>
    )
}

export default NitrogenBalanceDetails
