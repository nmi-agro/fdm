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
import type React from "react"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { NavLink } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { formatFixed } from "~/lib/format"

interface NitrogenBalanceDetailsProps {
  balanceData: NitrogenBalanceFieldNumeric
  fieldInput: FieldInput
}

/** Formats an N₂O value, which is small, with one decimal instead of a whole number. */
const formatNitrousOxide = (value: number) => formatFixed(value, 1)

/**
 * A row with a single value and no details, styled like an accordion row. It is not an accordion
 * item, so that assistive technology does not announce a section that cannot be opened.
 */
function StaticRow({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm font-medium not-last:border-b">{children}</p>
}

const NitrogenBalanceDetails: React.FC<NitrogenBalanceDetailsProps> = ({
  balanceData,
  fieldInput,
}) => {
  const calendar = useCalendarStore((state) => state.calendar)

  const renderSupply = (supply: NitrogenSupplyNumeric, fieldInput: FieldInput) => {
    const sectionKey = "supply"
    return (
      <AccordionItem value={sectionKey}>
        <AccordionTrigger>Aanvoer (Totaal): {formatFixed(supply.total)} kg N / ha</AccordionTrigger>
        <AccordionContent>
          <Accordion multiple className="ml-4">
            {/* Render Fertilizers */}
            {renderFertilizersSupply(supply.fertilizers, fieldInput)}

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
          Bemesting (Totaal): {formatFixed(fertilizers.total)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <Accordion multiple className="ml-4">
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
          {title} (Totaal): {formatFixed(applications.total)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <ul className="ml-6 list-outside list-disc space-y-1">
            {applications.applications.map((app: { id: string; value: number }) => {
              if (app.value === 0) {
                return null
              }
              const application = fieldInput.fertilizerApplications.find(
                (fa: { p_app_id: string }) => fa.p_app_id === app.id,
              )
              if (!application?.p_name_nl || !application.p_app_date) {
                console.error(`Application not found for id: ${app.id}`)
                return null
              }
              return (
                <li key={app.id} className="text-muted-foreground text-sm">
                  <NavLink to={`../../${calendar}/field/${fieldInput.field.b_id}/fertilizer`}>
                    {application.p_name_nl} op{" "}
                    {format(application.p_app_date, "PP", { locale: nl })}: {formatFixed(app.value)}{" "}
                    kg N / ha
                  </NavLink>
                </li>
              )
            })}
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
          Fixatie (Totaal): {formatFixed(fixation.total)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <ul className="ml-6 list-outside list-disc space-y-1">
            {fixation.cultivations.map((cult: { id: string; value: number }) => {
              if (cult.value === 0) {
                return null
              }

              const cultivation = fieldInput.cultivations.find(
                (cultivation: { b_lu: string }) => cultivation.b_lu === cult.id,
              )
              return cultivation ? (
                <li key={cult.id} className="text-muted-foreground text-sm">
                  <NavLink
                    to={`../../${calendar}/field/${fieldInput.field.b_id}/cultivation/${cultivation.b_lu}`}
                  >
                    {cultivation.b_lu_name}: {formatFixed(cult.value)} kg N / ha
                  </NavLink>
                </li>
              ) : null
            })}
          </ul>
        </AccordionContent>
      </AccordionItem>
    )
  }
  const renderDepositionSupply = (deposition: { total: number }) => {
    return <StaticRow>Depositie: {formatFixed(deposition.total)} kg N / ha</StaticRow>
  }

  const renderMineralizationSupply = (mineralization: NitrogenSupplyMineralizationNumeric) => {
    return <StaticRow>Mineralisatie: {formatFixed(mineralization.total)} kg N / ha</StaticRow>
  }

  const renderRemoval = (removal: NitrogenRemovalNumeric, fieldInput: FieldInput) => {
    const sectionKey = "removal"

    return (
      <AccordionItem value={sectionKey}>
        <AccordionTrigger>Afvoer (Totaal): {formatFixed(removal.total)} kg N / ha</AccordionTrigger>
        <AccordionContent>
          <Accordion multiple className="ml-4">
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
          Oogsten (Totaal): {formatFixed(harvests.total)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <ul className="ml-6 list-outside list-disc space-y-1">
            {harvests.harvests.map((harvest: { id: string; value: number }) => {
              const harvestDetails = fieldInput.harvests.find(
                (item: { b_id_harvesting: string }) => item.b_id_harvesting === harvest.id,
              )
              if (!harvestDetails) {
                console.error(`Harvest not found for id: ${harvest.id}`)
                return null
              }

              const cultivationDetails = fieldInput.cultivations.find(
                (cultivation: { b_lu: string }) => cultivation.b_lu === harvestDetails.b_lu,
              )
              if (!cultivationDetails) {
                console.error(`Cultivation not found for harvest: ${harvest.id}`)
                return null
              }

              const harvestDate = harvestDetails.b_lu_harvest_date

              return (
                <li key={harvest.id} className="text-muted-foreground text-sm">
                  <NavLink
                    to={`../../${calendar}/field/${fieldInput.field.b_id}/cultivation/${cultivationDetails.b_lu}/harvest/${harvest.id}`}
                  >
                    Oogst op{" "}
                    {harvestDate
                      ? format(harvestDate, "PP", {
                          locale: nl,
                        })
                      : "onbekende datum"}
                    : {formatFixed(harvest.value)} kg N / ha
                  </NavLink>
                </li>
              )
            })}
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
          Gewasresten (Totaal): {formatFixed(residues.total)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <ul className="ml-6 list-outside list-disc space-y-1">
            {residues.cultivations.map((cult: { id: string; value: number }) => {
              if (cult.value === 0) {
                return null
              }

              const cultivation = fieldInput.cultivations.find(
                (cultivation: { b_lu: string }) => cultivation.b_lu === cult.id,
              )
              return cultivation ? (
                <li key={cult.id} className="text-muted-foreground text-sm">
                  <NavLink
                    to={`../../${calendar}/field/${fieldInput.field.b_id}/cultivation/${cultivation.b_lu}`}
                  >
                    {cultivation.b_lu_name}: {formatFixed(cult.value)} kg N / ha
                  </NavLink>
                </li>
              ) : null
            })}
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
          Ammoniak (Totaal): {formatFixed(ammonia.total)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <Accordion multiple className="ml-4">
            {/* Render Fertilizers */}
            {renderFertilizersEmission(ammonia.fertilizers, fieldInput)}

            {/* Render Residues */}
            {renderResiduesEmission(ammonia.residues, fieldInput)}
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    )
  }

  const renderNitrateEmissions = (nitrate: NitrogenEmissionNumeric["nitrate"]) => {
    return <StaticRow>Nitraat: {formatFixed(nitrate.total)} kg N / ha</StaticRow>
  }

  const renderFertilizersEmission = (
    fertilizers: NitrogenEmissionNumeric["ammonia"]["fertilizers"],
    fieldInput: FieldInput,
  ) => {
    const sectionKey = "emission.ammonia.fertilizers"

    return (
      <AccordionItem value={sectionKey}>
        <AccordionTrigger>
          Bemesting (Totaal): {formatFixed(fertilizers.total)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <Accordion multiple className="ml-4">
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
    sectionKey = "emission.ammonia.residues",
    formatValue: (value: number) => string = (value) => formatFixed(value),
    title = "Gewasresten (Totaal)",
  ) => {
    return (
      <AccordionItem value={sectionKey}>
        <AccordionTrigger>
          {title}: {formatValue(residues.total)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <ul className="ml-6 list-outside list-disc space-y-1">
            {residues.cultivations.map((cult: { id: string; value: number }) => {
              if (cult.value === 0) {
                return null
              }

              const cultivation = fieldInput.cultivations.find(
                (cultivation: { b_lu: string }) => cultivation.b_lu === cult.id,
              )
              return cultivation ? (
                <li key={cult.id} className="text-muted-foreground text-sm">
                  <NavLink
                    to={`../../${calendar}/field/${fieldInput.field.b_id}/cultivation/${cultivation.b_lu}`}
                  >
                    {cultivation.b_lu_name}: {formatValue(cult.value)} kg N / ha
                  </NavLink>
                </li>
              ) : null
            })}
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
    formatValue: (value: number) => string = (value) => formatFixed(value),
  ) => {
    return (
      <AccordionItem value={sectionKey}>
        <AccordionTrigger>
          {title} (Totaal): {formatValue(applications.total)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <ul className="ml-6 list-outside list-disc space-y-1">
            {applications.applications.map((app: { id: string; value: number }) => {
              if (app.value === 0) {
                return null
              }
              const application = fieldInput.fertilizerApplications.find(
                (fa: { p_app_id: string }) => fa.p_app_id === app.id,
              )
              if (!application?.p_name_nl || !application.p_app_date) {
                console.error(`Application not found for id: ${app.id}`)
                return null
              }
              return (
                <li key={app.id} className="text-muted-foreground text-sm">
                  <NavLink to={`../../${calendar}/field/${fieldInput.field.b_id}/fertilizer`}>
                    {application.p_name_nl} op{" "}
                    {format(application.p_app_date, "PP", { locale: nl })}: {formatValue(app.value)}{" "}
                    kg N / ha
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </AccordionContent>
      </AccordionItem>
    )
  }

  const renderNitrousOxide = (
    nitrousOxide: NitrogenEmissionNumeric["nitrous_oxide"],
    fieldInput: FieldInput,
  ) => {
    const sectionKey = "nitrous_oxide"
    const fertilizers = nitrousOxide.fertilizers

    return (
      <AccordionItem value={sectionKey}>
        <AccordionTrigger>
          Lachgas (Totaal): {formatNitrousOxide(nitrousOxide.total)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground ml-4 text-sm">
            <span>{`CO₂-equivalent: ${formatFixed(nitrousOxide.co2eq)} kg CO₂-eq / ha`}</span>
          </p>
          <Accordion multiple className="ml-4">
            <AccordionItem value="nitrous_oxide.fertilizers">
              <AccordionTrigger>
                Bemesting (Totaal): {formatNitrousOxide(fertilizers.total)} kg N / ha
              </AccordionTrigger>
              <AccordionContent>
                <Accordion multiple className="ml-4">
                  {renderFertilizerEmissions(
                    fertilizers.mineral,
                    fieldInput,
                    "Minerale meststoffen",
                    "nitrous_oxide.fertilizers.mineral",
                    formatNitrousOxide,
                  )}
                  {renderFertilizerEmissions(
                    fertilizers.manure,
                    fieldInput,
                    "Mest",
                    "nitrous_oxide.fertilizers.manure",
                    formatNitrousOxide,
                  )}
                  {renderFertilizerEmissions(
                    fertilizers.compost,
                    fieldInput,
                    "Compost",
                    "nitrous_oxide.fertilizers.compost",
                    formatNitrousOxide,
                  )}
                  {renderFertilizerEmissions(
                    fertilizers.other,
                    fieldInput,
                    "Overig",
                    "nitrous_oxide.fertilizers.other",
                    formatNitrousOxide,
                  )}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
            {renderResiduesEmission(
              nitrousOxide.residues,
              fieldInput,
              "nitrous_oxide.residues",
              formatNitrousOxide,
              "Gewasresten",
            )}
            <StaticRow>
              Bodem (veen en moerige klei): {formatNitrousOxide(nitrousOxide.soil.total)} kg N / ha
            </StaticRow>
            <AccordionItem value="nitrous_oxide.indirect">
              <AccordionTrigger>
                Indirect (Totaal): {formatNitrousOxide(nitrousOxide.indirect.total)} kg N / ha
              </AccordionTrigger>
              <AccordionContent>
                <ul className="ml-6 list-outside list-disc space-y-1">
                  <li className="text-muted-foreground text-sm">
                    Nitrificatie en denitrificatie na ammoniakdepositie:{" "}
                    {formatNitrousOxide(nitrousOxide.indirect.volatilisation)} kg N / ha
                  </li>
                  <li className="text-muted-foreground text-sm">
                    Denitrificatie van uitgespoeld nitraat:{" "}
                    {formatNitrousOxide(nitrousOxide.indirect.leaching)} kg N / ha
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    )
  }

  const renderEmission = (emission: NitrogenEmissionNumeric, fieldInput: FieldInput) => {
    const sectionKey = "emission"

    return (
      <AccordionItem value={sectionKey}>
        <AccordionTrigger>
          Emissie (Totaal): {formatFixed(emission.total, 1)} kg N / ha
        </AccordionTrigger>
        <AccordionContent>
          <Accordion multiple className="ml-4">
            {renderAmmoniaEmissions(emission.ammonia, fieldInput)}
          </Accordion>
          <Accordion multiple className="ml-4">
            {renderNitrateEmissions(emission.nitrate)}
          </Accordion>
          <Accordion multiple className="ml-4">
            {renderNitrousOxide(emission.nitrous_oxide, fieldInput)}
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    )
  }

  return (
    <div>
      <Accordion multiple className="w-full">
        {renderSupply(balanceData.supply, fieldInput)}
        {renderRemoval(balanceData.removal, fieldInput)}
        {renderEmission(balanceData.emission, fieldInput)}
      </Accordion>
    </div>
  )
}

export default NitrogenBalanceDetails
