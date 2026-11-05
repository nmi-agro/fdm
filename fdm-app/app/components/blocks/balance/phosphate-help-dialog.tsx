import { PHOSPHATE_STATUS_RULES as R } from "@nmi-agro/fdm-calculator/browser"
import { HelpCircle } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { clientConfig } from "~/lib/config"
import { PHOSPHATE_VERDICT_TEXT } from "./phosphate-format"

const references: { text: string; href: string }[] = [
  {
    text: "van Doorn, M. (2026). Phostering sustainability. Proefschrift, Wageningen University.",
    href: "https://doi.org/10.18174/681704",
  },
  {
    text: "van Doorn, M. et al. (2025). Using the phosphorus saturation degree as a guide for sustainable phosphorus management. Journal of Environmental Management 384, 125617.",
    href: "https://doi.org/10.1016/j.jenvman.2025.125617",
  },
  {
    text: "van Doorn, M. et al. (2024). The phosphorus saturation degree as a universal agronomic and environmental soil P test. Critical Reviews in Environmental Science and Technology 54(5), 385–404.",
    href: "https://doi.org/10.1080/10643389.2023.2240211",
  },
  {
    text: "van Doorn, M. et al. (2026). Phosphorus leaching and runoff risks from non-calcareous sandy soils with a low sorption capacity and high hydrological connectivity. Journal of Environmental Quality 55, e70180.",
    href: "https://doi.org/10.1002/jeq2.70180",
  },
  {
    text: "van der Salm, C., van Middelkoop, J.C. & Ehlert, P.A.I. (2017). Changes in soil phosphorus pools of grasslands following 17 yrs of balanced application of manure and fertilizer. Soil Use and Management 33(1), 2–12.",
    href: "https://doi.org/10.1111/sum.12333",
  },
  {
    text: "Handboek Bodem en Bemesting: bodemgericht fosfaatadvies op basis van P-AL.",
    href: "https://www.handboekbodemenbemesting.nl/bemestingsadviezen/fosfaat/bodemgericht-advies-op-basis-van-p-al/",
  },
]

/**
 * Help dialog explaining why the phosphate balance is read differently from the nitrogen balance:
 * the soil stock decides whether a surplus or a deficit is desirable. Explains the target zone, the
 * three verdicts and their margins and horizons (taken from the calculator rules).
 */
export function PhosphateHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <HelpCircle className="h-4 w-4" />
          Hoe lees ik de fosfaatbalans?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hoe lees ik de fosfaatbalans?</DialogTitle>
        </DialogHeader>
        <div className="text-muted-foreground space-y-4 text-sm">
          <div className="space-y-1.5">
            <p className="text-foreground font-medium">Fosfaat is een voorraad</p>
            <p>
              Fosfaat verdwijnt nauwelijks naar de lucht of het grondwater. Wat niet met de oogst
              wordt afgevoerd, blijft in de bodem. Het saldo van één jaar verandert de P-AL maar
              weinig; over meerdere jaren bepaalt het saldo de voorraad. Een deel van het fosfaat
              (ongeveer 20 kg P₂O₅ per ha per jaar op minerale gronden) wordt vastgelegd. Ook bij
              een saldo van nul daalt de P-AL dus langzaam.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-foreground font-medium">De streefzone</p>
            <p>
              Elk perceel wordt beoordeeld tegen een streefzone met twee grenzen. De ondergrens is
              landbouwkundig: P-AL {R.p_al_min}, genoeg voor de opbrengst. De bovengrens is de
              milieugrens voor de fosfaatverzadiging (PSD), per perceel berekend uit P-CaCl₂ en de
              grondwatertrap (zonder P-CaCl₂ geldt 25%). Onder de zone is{" "}
              <strong className="text-foreground">opbouwen</strong> nodig, in de zone{" "}
              <strong className="text-foreground">onderhouden</strong>, erboven{" "}
              <strong className="text-foreground">afbouwen</strong>. In de zone is een negatief
              saldo geen probleem zolang het perceel in de zone blijft.
            </p>
            <p>
              Ligt de PSD boven de milieugrens terwijl P-AL voor de opbrengst op peil is, dan gaat
              het milieu voor: afbouwen kost dan geen opbrengst zolang P-AL boven {R.p_al_min}{" "}
              blijft. Zonder bruikbare PSD (bijvoorbeeld kalkrijk zand) is P-AL {R.p_al_min}–
              {R.p_al_high} de zone en is het oordeel indicatief.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-foreground font-medium">Waar, welke kant, hoe lang</p>
            <p>
              Het oordeel gebruikt het gemiddelde saldo van de afgelopen jaren (tot 5 jaar, zodat
              een vruchtwisseling meetelt), na vastlegging en uitspoeling. Precies op de grens komen
              is niet nodig: binnen {R.psd_margin} procentpunt van de PSD-grens of {R.p_al_margin}{" "}
              eenheden P-AL telt als bereikt.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {(["good", "attention", "adjust"] as const).map((verdict) => (
                <li key={verdict}>
                  <span className="text-foreground font-medium">
                    {PHOSPHATE_VERDICT_TEXT[verdict].label}
                  </span>
                  : {PHOSPHATE_VERDICT_TEXT[verdict].description.toLowerCase()}.
                </li>
              ))}
            </ul>
            <p>
              Voorbeeld: PSD 26% bij een grens van 20%, P-AL 37 en geen fosfaatbemesting. De PSD
              daalt, maar trager dan {R.reach_horizon} jaar tot de grens: <em>Aandacht</em>. Minder
              bemesten kan niet; alleen meer afvoer versnelt het afbouwen.
            </p>
            <p>
              Het advies noemt het gemiddelde saldo dat nodig is om het doel op tijd te halen. Is
              daarvoor meer fosfaat nodig dan de fosfaatgebruiksnorm van het perceel, dan staat daar
              een melding bij: de gebruiksnorm geldt op bedrijfsniveau.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-foreground font-medium">Mineralisatie, depositie en uitspoeling</p>
            <p>
              Bij de afbraak van organische stof komt fosfaat vrij. Op veen is dat veel meer en
              hangt het af van de grondwatertrap. Uit de lucht komt jaarlijks ongeveer 0,7 kg P₂O₅
              per ha. Beide tellen mee als aanvoer. Uitspoeling wordt geschat uit het overschot, de
              fosfaatverzadiging en de grondwatertrap en telt, net als bij stikstof, niet mee in het
              saldo.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-foreground font-medium">Wat niet is meegenomen</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Mest van weidende dieren.</li>
              <li>Het vrijkomen van fosfaat bij vernatting van veen (wel een melding).</li>
              <li>Uitspoeling uit de bestaande voorraad bij een tekort.</li>
              <li>
                Afspoeling en erosie: fosfaat dat met water en grond over het oppervlak wegspoelt.
              </li>
            </ul>
            <p>
              De uitkomsten zijn indicatief. Opbrengsten en mestgehalten variëren, waardoor het
              saldo van één perceel al gauw 15 tot 25 kg P₂O₅ per ha onzeker is. De rekenregels zijn
              een prototype en worden nog met de onderzoekers afgestemd.
            </p>
          </div>

          <p>
            Meer over de berekening staat in de{" "}
            <a
              href={`${clientConfig.docsUrl}/docs/insights/balance/phosphate-balance`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground underline"
            >
              documentatie van de fosfaatbalans
            </a>
            .
          </p>

          <div className="space-y-1.5">
            <p className="text-foreground font-medium">Bronnen</p>
            <ul className="space-y-1.5 text-xs">
              {references.map((reference) => (
                <li key={reference.href}>
                  <a
                    href={reference.href}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground underline"
                  >
                    {reference.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
