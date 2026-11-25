import { LandingSection, ManualLink } from "./landing-primitives"

const SPEC_GROUPS = [
  {
    title: "Rekenmodellen",
    rows: [
      { label: "Gebruiksnormen", value: "Meststoffenwet, met de normtabellen van RVO" },
      {
        label: "Stikstofbalans",
        value: "Aanvoer, afvoer en emissies per perceel, met een doel per perceel",
      },
      { label: "Emissies", value: "Ammoniak en lachgas volgens het rekenmodel NEMA" },
      {
        label: "Fosfaatbalans",
        value: "Aanvoer en afvoer naast de fosfaattoestand van de bodem (experimenteel)",
      },
      {
        label: "Organische stof",
        value: "Aanvoer van effectieve organische stof tegenover de afbraak",
      },
      { label: "NLV", value: "Stikstofleverend vermogen volgens het MINIP-model" },
      {
        label: "Mineralisatie",
        value: "Dyna-model van NMI, dag voor dag met het weer (experimenteel)",
      },
      { label: "Bemestingsadvies", value: "Adviezen van de CBGV en de CBAV" },
      { label: "Bodemkwaliteit", value: "BLN 3, met OBI en BBWP" },
      {
        label: "Beweiding",
        value: "Weidedagen en strookgrootte volgens het Handboek Melkveehouderij",
      },
    ],
  },
  {
    title: "Databronnen",
    rows: [
      { label: "Percelen", value: "RVO, via shapefile of eHerkenning" },
      { label: "Gewashistorie", value: "Basisregistratie Gewaspercelen (BRP), terug tot 2009" },
      { label: "Bedrijf", value: "KvK Handelsregister, voor naam en adres" },
      {
        label: "Bodem",
        value: "Bodemkaart van Nederland (BRO) en uw eigen bodemanalyses, ook als pdf van het lab",
      },
      { label: "Bodemschatting", value: "NMI BodemSchat, voor waarden die niet zijn gemeten" },
      {
        label: "Ligging",
        value: "Grondsoortregio, NV-gebieden, grondwaterbeschermings- en Natura 2000-gebieden",
      },
      { label: "Depositie", value: "Landelijke kaart van de stikstofdepositie" },
      { label: "Hoogte", value: "Actueel Hoogtebestand Nederland (AHN4)" },
    ],
  },
  {
    title: "Open techniek",
    rows: [
      { label: "Broncode", value: "Open source onder de MIT-licentie" },
      { label: "Datamodel", value: "Het open Farm Data Model (FDM)" },
      { label: "API", value: "REST API met documentatie waarin u endpoints kunt uitproberen" },
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
      {/* The models list is the longest, so it gets the left column; the other groups stack on the right. */}
      <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        {SPEC_GROUPS.map((group, index) => (
          <div key={group.title} className={index === 0 ? "lg:row-span-2" : undefined}>
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
