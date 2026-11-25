import { Bot, Building2, FileText, KeyRound, Plug, UserPlus } from "lucide-react"
import { clientConfig } from "~/lib/config"
import { FeatureItem, LandingSection, ManualLink, SectionHeading } from "./landing-primitives"

/** From insight to a plan: the bemestingsplan PDF and Gerrit (Labs). */
export function LandingPlan() {
  return (
    <LandingSection tone="muted">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <SectionHeading
          label="Van inzicht naar plan"
          title="Een bemestingsplan dat u kunt meegeven"
        >
          <p>
            De inzichten komen samen in één plan voor het komende seizoen, dat u zelf opstelt of
            laat voorstellen.
          </p>
        </SectionHeading>
        <div>
          <div className="space-y-8">
            <FeatureItem icon={FileText} title="Bemestingsplan als pdf">
              <p>
                Maak een bemestingsplan als pdf met de gebruiksruimte, het advies, de
                organische-stofbalans en per perceel de geplande bemestingen. Handig om mee te geven
                aan een teler of controleur.
              </p>
              <ManualLink target="bemestingsplan" className="mt-2">
                Lees meer over het bemestingsplan
              </ManualLink>
            </FeatureItem>
            <FeatureItem icon={Bot} title="Gerrit, de AI-bemestingsassistent" badge="Labs">
              <p>
                Gerrit stelt een bemestingsplan voor uw hele bedrijf voor: welke meststof, hoeveel
                en wanneer, per perceel. Daarbij telt Gerrit de gebruiksnormen, het
                bemestingsadvies, de stikstofbalans en uw eigen wensen mee. Het blijft een voorstel:
                u of uw adviseur beoordeelt het voordat het wordt toegepast.
              </p>
              <ManualLink target="gerrit" className="mt-2">
                Lees meer over Gerrit
              </ManualLink>
            </FeatureItem>
          </div>
          <p className="text-muted-foreground mt-8 text-sm leading-relaxed">
            Functies onder Labs zijn nog in ontwikkeling. Ze werken al, maar kunnen nog veranderen.
          </p>
        </div>
      </div>
    </LandingSection>
  )
}

/** Sharing a farm, organisations, and the API and MCP connections. */
export function LandingCollaborate() {
  return (
    <LandingSection id="samenwerken" tone="muted">
      <SectionHeading label="Samenwerken en koppelen" title="Deel uw bedrijf, behoud de regie">
        <p>
          U blijft eigenaar van uw data. Delen gebeurt alleen met uw toestemming en u trekt de
          toegang op elk moment weer in.
        </p>
      </SectionHeading>
      <div className="mt-12 grid gap-x-16 gap-y-10 md:grid-cols-2">
        <FeatureItem icon={UserPlus} title="Uw adviseur of collega uitnodigen">
          <p>
            Nodig iemand uit met het e-mailadres, of geef een hele organisatie toegang door op de
            naam te zoeken. U kiest de rol: eigenaar, adviseur of onderzoeker. Een onderzoeker kan
            alleen meekijken.
          </p>
          <ManualLink target="samenwerken" className="mt-2">
            Lees meer over samenwerken
          </ManualLink>
        </FeatureItem>
        <FeatureItem icon={Building2} title="Organisaties">
          <p>
            Adviesbureaus, studieclubs en overheden werken samen in een organisatie. Die krijgt
            overzichten over al haar bedrijven: de balansen, de bodemindicatoren op de kaart en de
            maatregelen.
          </p>
          <ManualLink target="organisaties" className="mt-2">
            Lees meer over organisaties
          </ManualLink>
        </FeatureItem>
        <FeatureItem icon={KeyRound} title="API">
          <p>
            Koppel uw eigen software of dashboard aan {clientConfig.name} met een API-sleutel. De
            documentatie, rechten en limieten staan in de handleiding.
          </p>
          <ManualLink target="api" className="mt-2">
            Lees meer over de API
          </ManualLink>
        </FeatureItem>
        <FeatureItem icon={Plug} title="AI-assistenten">
          <p>
            Koppel een AI-assistent via MCP, zodat die uw bedrijfsgegevens kan opzoeken, wijzigen en
            doorrekenen. De assistent werkt met uw eigen API-sleutel, en dus met uw rechten.
          </p>
          <ManualLink target="ai-assistenten" className="mt-2">
            Lees meer over AI-assistenten
          </ManualLink>
        </FeatureItem>
      </div>
    </LandingSection>
  )
}
