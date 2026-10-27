import { HelpCircle } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"

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
 * the soil stock decides whether a surplus or a deficit is desirable.
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
            <p className="text-foreground font-medium">Opbouwen, onderhouden of afbouwen</p>
            <p>
              Of een overschot of een tekort goed is, hangt af van de voorraad. Bij een lage P-AL
              (onder 25) is opbouwen gewenst, tussen 25 en 45 onderhouden en boven 45 afbouwen. Bij
              afbouwen is een <strong className="text-foreground">negatief saldo goed</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-foreground font-medium">Afbouwen is vaak de juiste keuze</p>
            <p>
              Op ongeveer 84% van de Nederlandse landbouwgrond ligt de fosfaatverzadiging boven het
              landbouwkundige streefniveau en op ongeveer 94% boven de milieugrens. De streefwaarden
              zijn afgestemd op 99% van de maximale opbrengst van het meest gevoelige gewas
              (aardappel). Afbouwen van een rijke bodem kost daarom weinig opbrengst.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-foreground font-medium">Fosfaatverzadiging (milieu)</p>
            <p>
              De fosfaatverzadigingsgraad (PSD) is het deel van de bindingscapaciteit van de bodem
              dat al met fosfaat gevuld is. De grenswaarde wordt per perceel berekend uit P-CaCl₂ en
              de grondwatertrap; zonder P-CaCl₂ geldt 25%.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-foreground font-medium">Wat (nog) niet is meegenomen</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Mest van weidende dieren.</li>
              <li>Mineralisatie van organisch fosfaat (ook in veen), depositie en uitspoeling.</li>
              <li>Het vrijkomen van fosfaat bij vernatting van veen.</li>
            </ul>
            <p>
              De uitkomsten zijn indicatief. Opbrengsten en mestgehalten variëren, waardoor het
              saldo van één perceel al gauw 15 tot 25 kg P₂O₅ per ha onzeker is. De rekenregels zijn
              een prototype en worden nog met de onderzoekers afgestemd.
            </p>
          </div>

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
