import { AlertTriangle, ClipboardList, Gauge } from "lucide-react"
import { Link } from "react-router"
import { clientConfig } from "~/lib/config"
import { IndicatorCalculationFlow } from "./indicator-calculation-flow"
import { IndicatorShowcaseCarousel } from "./indicator-showcase-carousel"
import {
  FeatureItem,
  LandingSection,
  ManualLink,
  ProductShot,
  SectionHeading,
} from "./landing-primitives"

const NITROGEN_FLOW = [
  {
    title: "Aanvoer",
    text: "Kunstmest, dierlijke mest, compost, overige meststoffen, bodemlevering en depositie.",
  },
  {
    title: "Afvoer en emissie",
    text: "Oogst, gewasresten, ammoniak en nitraat.",
  },
  {
    title: "Stikstofbodemoverschot",
    text: "Laat zien hoe efficiënt stikstof wordt gebruikt.",
  },
  {
    title: "Waterkwaliteit",
    text: "Nitraatuitspoeling, berekend als fractie van het overschot.",
  },
]

/** Nitrogen balance (the basis for doelsturing) and the organic-matter balance. */
export function LandingBalances() {
  return (
    <LandingSection>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <SectionHeading label="Balansen" title="De stikstofbalans als basis voor doelsturing">
          <p>
            Doelsturing geeft u de ruimte om zelf maatregelen te kiezen voor waterkwaliteit en
            ammoniakemissie. Dat vraagt veel en gedetailleerde data. {clientConfig.name} maakt die
            berekening zo eenvoudig mogelijk, zonder in te leveren op nauwkeurigheid.
          </p>
          <p>
            Daarnaast rekent {clientConfig.name} de organische-stofbalans door: de aanvoer en
            afbraak van organische stof, per perceel en voor het bedrijf.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <ManualLink to="/manual/background/stikstofbalans">
              Zo wordt de stikstofbalans berekend
            </ManualLink>
            <ManualLink to="/manual/background/organische-stofbalans">
              Zo wordt de organische-stofbalans berekend
            </ManualLink>
          </div>
        </SectionHeading>
        <ProductShot
          manualId="balans-stikstof"
          frameClassName="aspect-[16/9]"
          alt={`De stikstofbalans van een demobedrijf in ${clientConfig.name}: aanvoer, afvoer, emissie en het overschot per perceel`}
          caption="De stikstofbalans: aanvoer, afvoer en emissie voor het bedrijf, en per perceel het overschot naast het doel."
        />
      </div>
      <dl className="mt-14 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {NITROGEN_FLOW.map((part) => (
          <div key={part.title} className="border-t pt-4">
            <dt className="font-semibold">{part.title}</dt>
            <dd className="text-muted-foreground mt-1 text-[0.9375rem] leading-relaxed">
              {part.text}
            </dd>
          </div>
        ))}
      </dl>
    </LandingSection>
  )
}

/** Legal usage norms next to the agronomic fertilizer advice, with the advice table as evidence. */
export function LandingNormsAndAdvice() {
  return (
    <LandingSection tone="muted">
      <SectionHeading
        label="Normen en advies"
        title="Binnen de wettelijke ruimte, volgens het landbouwkundig advies"
      />
      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Gebruiksruimte</h3>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            {clientConfig.name} berekent de gebruiksruimte voor stikstof, fosfaat en dierlijke mest
            per perceel en telt die op naar het bedrijf. U ziet de opbouw van de berekening, met
            alle correcties en normen die voor uw situatie gelden.
          </p>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            De getallen zijn indicatief en bedoeld als ondersteuning. Voor definitieve opgaven
            verwijzen we u naar RVO en uw adviseur.
          </p>
          <ManualLink to="/manual/background/gebruiksruimte" className="mt-4">
            Zo wordt de gebruiksruimte berekend
          </ManualLink>
        </div>
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Bemestingsadvies</h3>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            Per perceel en gewas ziet u de gewenste bemesting volgens de adviezen van de CBGV
            (Bemestingsadvies) en de CBAV (Handboek Bodem en Bemesting): voor N, P en K, organische
            stof, secundaire nutriënten en micronutriënten. Ernaast staat wat u al heeft gegeven.
          </p>
          <ManualLink to="/manual/background/bemestingsadvies" className="mt-4">
            Zo wordt het bemestingsadvies berekend
          </ManualLink>
        </div>
      </div>
      <ProductShot
        src="/fdm-screenshot-nutrient-advice-npk.png"
        alt="Bemestingsadvies voor stikstof, fosfaat en kalium, met per nutriënt het advies en de gegeven hoeveelheid"
        caption="Het bemestingsadvies voor N, P en K, met per nutriënt hoeveel er al is gegeven."
        className="mt-12"
      />
    </LandingSection>
  )
}

/** Soil quality: BLN indicators, measures, the recognised methods and how a score is calculated. */
export function LandingSoilQuality() {
  return (
    <LandingSection>
      <div className="grid items-start gap-12 lg:grid-cols-2">
        <SectionHeading label="Bodemkwaliteit" title="Bodemindicatoren vertaald naar maatregelen">
          <p>
            Met Indicatoren brengt {clientConfig.name} de bodemkwaliteit van uw percelen in beeld,
            van waterkwaliteit en klimaat tot productie. Met Maatregelen koppelt u daar acties aan
            per perceel, zodat u ziet waar de bodem aandacht vraagt en wat u eraan doet.
          </p>
          <ManualLink to="/manual/background/bln3-bodemkwaliteit">
            Zo worden de indicatoren berekend
          </ManualLink>
        </SectionHeading>
        <div className="space-y-6 lg:pt-9">
          <FeatureItem icon={Gauge} title="Van bedrijfsscore tot indicator">
            Klik vanuit het bedrijfsgemiddelde door naar thema's als Water, Klimaat,
            Nutriëntenkringloop en Productie, tot op indicatoren zoals fosfaatbeschikbaarheid of
            grondwateraanvulling.
          </FeatureItem>
          <FeatureItem icon={AlertTriangle} title="Knelpunten in één oogopslag">
            De knelpuntenanalyse laat zien welke indicatoren achterblijven en welke percelen daar
            het meest aan bijdragen.
          </FeatureItem>
          <FeatureItem icon={ClipboardList} title="Maatregelen koppelen">
            Koppel een maatregel aan één of meer percelen, leg de startdatum en looptijd vast en
            volg de voortgang.
          </FeatureItem>
        </div>
      </div>

      <div className="mt-14 flex flex-wrap items-center gap-x-10 gap-y-4 border-y py-6">
        <span className="text-muted-foreground text-sm font-medium">
          Volgens de methodieken van
        </span>
        <Link
          to="https://openbodemindex.nl/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md"
        >
          <img
            src="/obi-logo.png"
            alt="Open Bodemindex (OBI)"
            loading="lazy"
            className="h-8 w-auto object-contain"
          />
        </Link>
        <Link
          to="https://bedrijfsbodemwaterplan.nl/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md"
        >
          <img
            src="/bbwp-logo.png"
            alt="BedrijfsBodemWaterPlan (BBWP)"
            loading="lazy"
            className="h-8 w-auto object-contain"
          />
        </Link>
        <Link
          to="https://edepot.wur.nl/634579"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground rounded-md text-2xl font-semibold"
          aria-label="Bodemindicatoren voor Landbouwgronden in Nederland (BLN)"
        >
          BLN
        </Link>
      </div>

      <div className="mt-14">
        <IndicatorShowcaseCarousel />
      </div>

      <div className="mt-20">
        <div className="mb-12 max-w-2xl">
          <h3 className="text-2xl font-semibold tracking-tight text-balance">
            Hoe een indicatorscore wordt berekend
          </h3>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Elke indicator doorloopt dezelfde rekenstappen, van uw invoerdata tot de score op de
            indicatorenpagina.
          </p>
        </div>
        <IndicatorCalculationFlow />
      </div>
    </LandingSection>
  )
}

/** The atlas: crop rotation, crop history, elevation, regional norms and soil data on the map. */
export function LandingAtlas() {
  return (
    <LandingSection tone="muted">
      <SectionHeading label="Atlas" title="Percelen, hoogte en bodem op de kaart">
        <p>
          Verken agrarisch Nederland op de kaart. Blader door de jaren en zie de perceelshistorie,
          het microreliëf en de gebiedskenmerken.
        </p>
      </SectionHeading>
      <div className="mt-12 grid gap-x-8 gap-y-10 lg:grid-cols-3">
        <ProductShot
          src="/fdm-screenshot-atlas-cultivations.png"
          alt="Kaart met gewaspercelen, ingekleurd per gewasgroep"
          caption={
            <>
              <strong className="text-foreground font-semibold">Gewasrotatie.</strong> Gewaspercelen
              terug tot 2020, ingekleurd per gewasgroep.
            </>
          }
          className="lg:col-span-2"
        />
        <ProductShot
          src="/fdm-screenshot-atlas-cultivation-history.png"
          alt="Gewashistorie van één perceel, per jaar"
          caption={
            <>
              <strong className="text-foreground font-semibold">Gewashistorie.</strong> Klik op een
              perceel voor de gewassen terug tot 2009.
            </>
          }
          imageClassName="mx-auto max-h-[26rem] w-auto"
        />
        <ProductShot
          src="/fdm-screenshot-atlas-elevation.png"
          alt="Hoogtekaart AHN4 met het hoogteverloop binnen percelen"
          caption={
            <>
              <strong className="text-foreground font-semibold">Hoogtekaart (AHN4).</strong> Het
              hoogteverloop binnen en rond uw percelen.
            </>
          }
          className="lg:col-span-2"
        />
        <dl className="space-y-6 lg:pt-2">
          <div className="border-t pt-4">
            <dt className="font-semibold">Gebiedsgerichte normen</dt>
            <dd className="text-muted-foreground mt-1 text-[0.9375rem] leading-relaxed">
              Zie in welke regio's voor de gebruiksnormen een perceel ligt.
            </dd>
          </div>
          <div className="border-t pt-4">
            <dt className="font-semibold">Bodem en water</dt>
            <dd className="text-muted-foreground mt-1 text-[0.9375rem] leading-relaxed">
              Van grondwatertrappen tot de bodemsamenstelling, zoals het zand-, klei- en
              siltgehalte.
            </dd>
          </div>
        </dl>
      </div>
    </LandingSection>
  )
}
