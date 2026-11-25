import { LandingSection, ManualLink } from "./landing-primitives"

const SPEC_GROUPS = [
  {
    title: "Rekenmodellen",
    rows: [
      {
        label: "Stikstofbalans",
        value: "Aanvoer, afvoer en emissies per perceel, met een doel per perceel",
      },
      { label: "Emissies", value: "Ammoniak en lachgas volgens het rekenmodel NEMA" },
      { label: "Mineralisatie", value: "MINIP-model, voor de werkzame stikstof in de balans" },
      { label: "Bemestingsadvies", value: "Adviezen van de CBGV en de CBAV" },
      { label: "Bodemkwaliteit", value: "BLN 3, met OBI en BBWP" },
    ],
  },
  {
    title: "Databronnen",
    rows: [
      { label: "Percelen", value: "RVO, via shapefile of eHerkenning" },
      { label: "Gewashistorie", value: "Basisregistratie Gewaspercelen (BRP), terug tot 2009" },
      { label: "Hoogte", value: "Actueel Hoogtebestand Nederland (AHN4)" },
      { label: "Bodem", value: "Bodemkaart van Nederland (BRO) en uw eigen bodemanalyses" },
    ],
  },
  {
    title: "Open techniek",
    rows: [
      { label: "Broncode", value: "Open source onder de MIT-licentie" },
      { label: "Datamodel", value: "Het open Farm Data Model (FDM)" },
      { label: "API", value: "REST API met documentatie waarin u verzoeken kunt uitproberen" },
      { label: "AI-assistenten", value: "Eigen MCP-server" },
    ],
  },
]

/** A specification sheet of the models, data sources and open technology behind the product. */
export function LandingEngine() {
  return (
    <LandingSection tone="dark">
      <div className="max-w-2xl">
        <p className="mb-3 text-sm font-medium text-white/70">Onder de motorkap</p>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Rekenmodellen, landelijke data en open techniek
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-pretty text-white/80">
          De berekeningen gebruiken beschreven rekenmodellen, uw eigen gegevens en landelijke
          datasets. Hoe ze werken en waar hun beperkingen liggen, staat in de handleiding.
        </p>
        <ManualLink overview="background" className="mt-5" onDark>
          Lees de achtergrond bij de berekeningen
        </ManualLink>
      </div>
      <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-3">
        {SPEC_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-medium text-white/70">{group.title}</h3>
            <dl className="mt-3 border-t border-white/15">
              {group.rows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-4 border-b border-white/15 py-3 text-[0.9375rem] leading-relaxed"
                >
                  <dt className="text-white/70">{row.label}</dt>
                  <dd className="font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </LandingSection>
  )
}
