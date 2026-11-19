import { Camera, FileUp, GanttChart, ScanText, Table2 } from "lucide-react"
import { clientConfig } from "~/lib/config"
import {
  FeatureItem,
  LandingSection,
  ManualLink,
  ProductShot,
  SectionHeading,
} from "./landing-primitives"

const STEPS = [
  {
    title: "Vastleggen",
    text: "Haal uw percelen op bij RVO en vul gewassen, bemesting, oogsten en bodemanalyses aan. U voert alleen in wat u zelf weet.",
  },
  {
    title: "Doorrekenen",
    text: `${clientConfig.name} leidt daar de balansen, normen, adviezen en bodemindicatoren uit af. Bij elk resultaat ziet u hoe het is opgebouwd.`,
  },
  {
    title: "Gebruiken",
    text: "Vergelijk percelen en jaren, maak een bemestingsplan als pdf en deel het bedrijf met uw adviseur.",
  },
]

/** Explains the product in three steps: raw farm data in, connected insight out. */
export function LandingHowItWorks() {
  return (
    <LandingSection id="mogelijkheden">
      <SectionHeading
        label="Zo werkt het"
        title="Eén keer vastleggen, alles in samenhang doorgerekend"
      >
        <p>
          Dezelfde bedrijfsgegevens voeden elke berekening. U hoeft niets over te tikken in losse
          rekentools en u voert geen afgeleide waarden in.
        </p>
      </SectionHeading>
      <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-0 md:divide-x">
        {STEPS.map((step, index) => (
          <li key={step.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
            <p className="text-muted-foreground text-sm font-medium tabular-nums">
              Stap {index + 1}
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">{step.title}</h3>
            <p className="text-muted-foreground mt-2 leading-relaxed">{step.text}</p>
          </li>
        ))}
      </ol>
    </LandingSection>
  )
}

/** Shows how farm data gets into the app: imports, tables, the timeline and field assessment. */
export function LandingRecord() {
  return (
    <LandingSection tone="muted">
      <SectionHeading label="Gegevens vastleggen" title="Snel op orde, zonder overtikken">
        <p>
          Invoeren is het meeste werk. Daarom haalt {clientConfig.name} zoveel mogelijk op uit wat u
          al heeft, en ziet u in één beeld wat er nog ontbreekt.
        </p>
      </SectionHeading>
      <ProductShot
        manualId="tijdlijn"
        alt={`De tijdlijn van een demobedrijf in ${clientConfig.name}: per perceel de gewassen, bemestingen, oogsten en bodemanalyses over het jaar`}
        caption="De tijdlijn: gewassen als balken, bemestingen, oogsten en bodemanalyses als momenten."
        frameClassName="aspect-[5/2]"
        className="mt-10"
      />
      <div className="mt-12">
        <div>
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureItem icon={FileUp} title="Percelen ophalen bij RVO">
              Lees uw percelen in via een RVO-shapefile of importeer ze direct bij RVO met
              eHerkenning. De percelen staan er meteen goed in, inclusief het gewas.
            </FeatureItem>
            <FeatureItem icon={ScanText} title="Bodemanalyses uit de pdf">
              Upload de pdf's van uw bodemanalyses, ook meerdere tegelijk. {clientConfig.name} leest
              de waarden uit en koppelt ze aan het perceel. Geen analyse? Dan rekent{" "}
              {clientConfig.name} met bodemwaarden die het NMI schat.
            </FeatureItem>
            <FeatureItem icon={Table2} title="Tabellen voor het hele bedrijf">
              Beheer bouwplan, bemesting en oogst in tabellen en voer een actie uit voor meerdere
              percelen of gewassen tegelijk.
            </FeatureItem>
            <FeatureItem icon={GanttChart} title="Tijdlijn">
              Zie het hele jaar in één beeld: per perceel de gewassen als balken en de bemestingen,
              oogsten en bodemanalyses als momenten. Aanpassen kan door te klikken en te slepen.
            </FeatureItem>
            <FeatureItem icon={Camera} title="BodemConditieScore">
              Beoordeel de bodem in het veld, leg uw bodemkuil vast met foto's en notities en
              bereken de BodemConditieScore.
            </FeatureItem>
          </div>
          <ManualLink to="/manual/aan-de-slag" className="mt-10">
            Aan de slag in de handleiding
          </ManualLink>
        </div>
      </div>
    </LandingSection>
  )
}
