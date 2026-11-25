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
    title: "Gegevens vastleggen",
    text: "Percelen haalt u op bij RVO en bodemanalyses leest u in uit de pdf. Bemesting en oogst voert u zelf in; daar is nog geen koppeling voor.",
  },
  {
    title: "Doorrekenen",
    text: `${clientConfig.name} leidt daar de balansen, emissies, normen, adviezen en bodemindicatoren uit af. Bij de resultaten ziet u hoe ze zijn opgebouwd.`,
  },
  {
    title: "Bijsturen",
    text: "Vergelijk percelen en jaren, zie waar het knelt en kies de bemesting en maatregelen die daarbij passen.",
  },
]

/** Explains the product in three steps: raw farm data in, connected insight out. */
export function LandingHowItWorks() {
  return (
    <LandingSection id="mogelijkheden">
      <SectionHeading label="Zo werkt het" title="Inzicht in productie en milieu, in één beeld">
        <p>
          {clientConfig.name} gebruikt de gegevens van uw bedrijf om inzicht te geven in bemesting
          en bodem op uw percelen, en in wat dat betekent voor water en lucht. Dezelfde gegevens
          voeden de verschillende berekeningen, dus wat u één keer vastlegt, gebruikt u overal.
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
    <LandingSection>
      <SectionHeading label="Uw gegevens" title="Ophalen waar het kan, invoeren waar het moet">
        <p>
          Het inzicht is zo goed als de gegevens eronder. Percelen en bodemanalyses haalt u op met
          een import. Voor bemesting en oogst is er nog geen koppeling: die voert u zelf in. Dat
          kost wat tijd, maar we maken het zo eenvoudig mogelijk, en de tijdlijn laat zien wat er
          nog ontbreekt.
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
              eHerkenning. De percelen komen er met het gewas in te staan.
            </FeatureItem>
            <FeatureItem icon={ScanText} title="Bodemanalyses uit de pdf">
              Upload de pdf's van uw bodemanalyses, ook meerdere tegelijk. {clientConfig.name} leest
              de waarden uit; u controleert ze en koppelt ze aan het perceel. Geen analyse? Dan
              rekent {clientConfig.name} met bodemwaarden die het NMI schat.
            </FeatureItem>
            <FeatureItem icon={Table2} title="Invoeren in tabellen">
              Voer bemesting en oogst in en werk het bouwplan bij in tabellen. Een bemesting of
              oogst die op meerdere percelen gelijk is, legt u in één keer vast voor al die
              percelen.
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
          <ManualLink target="aan-de-slag" className="mt-10">
            Aan de slag in de handleiding
          </ManualLink>
        </div>
      </div>
    </LandingSection>
  )
}
