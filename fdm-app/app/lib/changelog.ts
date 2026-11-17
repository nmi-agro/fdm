import { clientConfig } from "~/lib/config"

/**
 * A single change within a release.
 */
export interface ChangelogItem {
  /** Short name of the change, shown as the item heading. */
  title: string
  /** Explanation of the change. Omitted for one-line items. */
  body?: string
  /** A later release that corrected this item, with the corrected statement. */
  correction?: {
    version: string
    text: string
  }
}

/**
 * A published release of the application.
 */
export interface ChangelogRelease {
  /** Version label, e.g. `v0.39.0`. */
  version: string
  /** Release date as an ISO 8601 calendar date (`YYYY-MM-DD`). */
  date: string
  title: string
  description: string
  items: ChangelogItem[]
}

/**
 * Converts a version label into an id that can be used as an HTML anchor, e.g. `v0.39.0` → `v0-39-0`.
 *
 * @param version - Version label of a release.
 * @returns The anchor id for the release.
 */
export function getReleaseAnchorId(version: string): string {
  return version.replaceAll(".", "-")
}

/**
 * Compares two version labels of the form `v<major>.<minor>.<patch>`.
 *
 * @param a - First version label.
 * @param b - Second version label.
 * @returns A negative number when `a` is older than `b`, a positive number when it is newer and 0 when equal.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) =>
    version
      .replace(/^v/, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0)
  const left = parse(a)
  const right = parse(b)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * All releases, newest first. The first entry drives the "new update" notification in the sidebar.
 */
export const changelogReleases: ChangelogRelease[] = [
  {
    version: "v0.39.0",
    date: "2026-10-28",
    title:
      "Effect van een bemesting zien vóór het opslaan, bedrijfsgroepen en bemestingsadvies op de kaart",
    description:
      "Bij het invoeren van een bemesting ziet u nu vóór het opslaan wat die betekent voor de gebruiksruimte, het bemestingsadvies en de stikstofbalans. In de Atlas kunt u het bemestingsadvies per perceel op de kaart bekijken, en organisaties kunnen hun bedrijven in groepen indelen. Daarnaast kunt u bij het importeren van percelen per kolom kiezen welke waarde u overneemt.",
    items: [
      {
        title: "Effect van een bemesting vooraf zien",
        body: "Bij het toevoegen of wijzigen van een bemesting ziet u tijdens het invullen wat deze betekent voor de gebruiksruimte, het N-, P₂O₅- en K₂O-advies en de stikstofbalans, per perceel en voor het hele bedrijf. Een overschrijding van een norm geeft een waarschuwing, maar opslaan blijft mogelijk. Dit geldt voor een bemesting op meerdere percelen, op één perceel en voor het aanpassen van meerdere bemestingen met dezelfde meststof tegelijk. De formulieren staan nu op een eigen pagina in plaats van in een venster.",
      },
      {
        title: "Bemestingsadvies op de kaart",
        body: "In de Atlas is de kaartlaag 'Bemestingsadvies' toegevoegd. Elk perceel krijgt een kleur op basis van wat er voor het gekozen nutriënt nog gegeven kan worden, welk deel van het advies al is gegeven of het advies zelf. Het advies verschijnt per perceel zodra het is berekend. Op de kaart, in de tabel en in de samenvattingen worden nu dezelfde kleuren gebruikt: oranje onder 90% van het advies, groen tussen 90% en 110% en rood daarboven.",
      },
      {
        title: "Bedrijfsgroepen voor organisaties",
        body: "Organisaties kunnen hun bedrijven indelen in groepen, bijvoorbeeld per project of studiegroep. Per bedrijf legt u vast vanaf wanneer, en eventueel tot wanneer, het bij een groep hoort. Op de organisatiepagina's voor de balansen, indicatoren, maatregelen en de indicatorenkaart kunt u een groep kiezen en ziet u alleen de bedrijven die in het gekozen jaar tot die groep behoorden.",
      },
      {
        title: "Stikstofbalans met werkzame stikstof",
        body: "U kunt de stikstofbalans nu ook berekenen met werkzame stikstof in plaats van totale stikstof. De streefwaarde geldt alleen voor de berekening met totale stikstof en wordt daarom alleen daar getoond.",
      },
      {
        title: "Gebruiksnormen gecorrigeerd en aangevuld",
        body: "Voor tijdelijk grasland wordt de periode uit tabel 2 van RVO nu nauwkeuriger bepaald, onder meer bij laat gezaaid gras en bij grasland dat in het voorjaar wordt gescheurd voor een andere teelt. Voor gras voor industriële verwerking telt de zaaidatum mee. In 2026 gelden de kortingen voor graslandvernieuwing en -vernietiging alleen op zand en löss; in de vorige versie werden ze ook op klei en veen toegepast. De norm voor 'Bladgewassen overig' en 'Kruiden' wordt nu berekend. In de toelichting bij de normen staan twee situaties die niet worden ondersteund: aparte normen voor wortel- en zaadkruiden, en uitgroeiteelt van aardappelen met loofvernietiging na 15 augustus.",
      },
      {
        title: "Percelen importeren: keuze per kolom",
        body: "Bij het vergelijken van uw percelen met die van RVO of een shapefile kiest u nu per kolom of u de waarde van RVO overneemt, de huidige waarde houdt of zelf een waarde invult. Standaard volgt elk perceel RVO. Voordat de wijzigingen worden doorgevoerd, ziet u welke percelen worden toegevoegd, bijgewerkt, beëindigd of verwijderd.",
      },
      {
        title: "Teeltcodes per jaar",
        body: "U kunt alleen nog gewascodes kiezen die RVO in het betreffende jaar accepteert. Bestaande teelten blijven ongewijzigd; is hun code niet meer geldig, dan ziet u een waarschuwing.",
      },
      {
        title: "Aanbevolen maatregelen",
        body: "Van maatregelen met varianten, zoals 'Hoger stuwpeil in hoofdwatergang' met 20 cm of 35 cm, wordt alleen nog de variant met het meeste effect aanbevolen. Voor de indicatoren worden nu alle bodemanalyses tot en met het gekozen jaar gebruikt, zodat vaker met gemeten waarden wordt gerekend.",
      },
      {
        title: "Bedrijfsgegevens uit het KvK Handelsregister",
        body: "Bij het aanmaken van een bedrijf worden de naam en het adres opgehaald aan de hand van het KvK-nummer. Op de instellingenpagina van een bedrijf kunt u dit later ook doen.",
      },
      {
        title: "Gegevens beschikbaar via de API",
        body: "De BLN3-indicatoren, de aanbevolen maatregelen en de bedrijfsgroepen zijn nu ook op te vragen via de API, zodat andere systemen met dezelfde scores en aanbevelingen kunnen werken. Meer informatie vindt u in de documentatie van de API.",
      },
      {
        title: "Kalenderjaar en einddatum van percelen",
        body: "Een perceel dat op 31 december of 1 januari is beëindigd, verschijnt niet meer in het volgende jaar. Opent u een perceel voor een jaar waarin het niet in gebruik is, dan ziet u een melding met een link naar het juiste jaar.",
      },
      {
        title: "Percelen ophalen bij RVO met uw eigen eHerkenning",
        body: "Voordat u verbinding maakt met RVO, kiest u of u inlogt met de eHerkenning van het bedrijf zelf of met die van uw organisatie met een machtiging. Boeren die met hun eigen eHerkenning inloggen, krijgen niet langer de melding 'Toegang geweigerd'. De geverifieerde status van bedrijven wordt voorlopig niet getoond.",
      },
      {
        title: "Kleine verbeteringen",
        body: "De BLN3-indicatoren konden voor sommige percelen niet worden berekend; dat is opgelost. Het webadres van een organisatie blijft gelijk wanneer u de naam wijzigt. De eenheden en namen van enkele bodemparameters zijn in lijn gebracht met de definities van het NMI. Een BodemConditieScore heeft in de Tijdlijn een eigen pictogram, en geselecteerde rijen in de percelentabel zijn groen gemarkeerd.",
      },
    ],
  },
  {
    version: "v0.37.0",
    date: "2026-10-02",
    title: "Bewerken in de Tijdlijn en AI-bemestingsassistent beschikbaar voor iedereen",
    description:
      "Gerrit, de AI-bemestingsassistent, is nu beschikbaar voor alle gebruikers, als experimentele functie. In de Tijdlijn kunt u teelten, bemestingen, oogsten en bodemanalyses nu direct toevoegen, aanpassen, verplaatsen en verwijderen. Daarnaast kunt u een BodemConditieScore achteraf bewerken, bijlagen toevoegen aan berichten in de helpdesk en is het gekozen kalenderjaar op meer plaatsen leidend.",
    items: [
      {
        title: "Gerrit voor iedereen beschikbaar",
        body: "Gerrit is een AI-systeem dat een bemestingsplan voor uw bedrijf voorstelt, rekening houdend met de wettelijke gebruiksnormen, het bemestingsadvies en uw voorkeuren. U vindt Gerrit in de zijbalk van een bedrijf, voor de jaren 2025 en 2026. Gerrit blijft een experimentele functie: voorlopig kunt u Gerrit maximaal 3 keer per dag gebruiken. Gerrit is een beslissingsondersteunend systeem. Een voorstel is een advies en moet altijd door u of uw adviseur worden gecontroleerd voordat u het toepast. Op de pagina van Gerrit leest u hoe het systeem werkt en wat de beperkingen zijn.",
      },
      {
        title: "Bewerken in de Tijdlijn",
        body: "Klikt u in de Tijdlijn op een teelt, bemesting, oogst of bodemanalyse, of op een lege plek, dan opent een menu met de details (met een link naar de bijbehorende pagina) en de acties die daarbij passen. Bij een teelt kunt u een bemesting toevoegen, een oogst registreren of de teelt beëindigen; op een lege plek kunt u een teelt, bemesting of bodemanalyse toevoegen. Bewerken gebeurt in een zijpaneel met een ingevuld formulier. Verwijderen vraagt om bevestiging; bodemanalyses kunt u ook verwijderen, behalve een BodemConditieScore. Op een telefoon opent het menu door op een gebeurtenis te tikken.",
      },
      {
        title: "Verslepen in de Tijdlijn",
        body: "In de Tijdlijn kunt u de randen van een teeltbalk slepen om de start- of einddatum aan te passen, de hele balk slepen om de teelt te verplaatsen, en een bemesting of oogst slepen om de datum te wijzigen. Tijdens het slepen ziet u de nieuwe datum en elke wijziging wordt direct opgeslagen. Met de knop 'Ongedaan maken' naast de knoppen boven het diagram draait u de laatste verplaatsing terug.",
      },
      {
        title: "BodemConditieScore bewerken",
        body: "Een bestaande BodemConditieScore kunt u nu aanpassen. U vindt de knop 'Bewerken' op de detailpagina, waarmee u de datum, scores, foto's en notities kunt wijzigen. Foto's kunt u ook weer verwijderen. Foto's in staand formaat worden niet langer als smalle strook bijgesneden.",
      },
      {
        title: "Bemonsteringsdatum en diepte van bodemanalyses aanpassen",
        body: "De bemonsteringsdatum en de onderste bemonsteringsdiepte van een bodemanalyse kunnen nu achteraf worden gewijzigd, en een waarde kan worden leeggemaakt.",
      },
      {
        title: "Bijlagen in de helpdesk",
        body: "Bij het aanmaken van een ticket of het schrijven van een bericht kunt u bijlagen toevoegen, bijvoorbeeld een schermafbeelding of een bestand waarmee een probleem duidelijk wordt; per bericht kunt u maximaal 5 bijlagen toevoegen. Bijlagen zijn zichtbaar voor wie het bericht kan inzien en staan ook in de e-mailmelding van een nieuw bericht.",
      },
      {
        title: "Meerdere rijen selecteren met shift-klik",
        body: "In de tabellen met percelen, het bouwplan en de maatregelen per perceel kunt u een reeks rijen selecteren door het vinkvakje van een rij aan te klikken, de shift-toets in te houden en op het vinkvakje van een andere rij te klikken. De selectie volgt de gesorteerde volgorde van de tabel.",
      },
      {
        title: "Beter sorteren in tabellen",
        body: "In het bouwplan kunt u nu correct sorteren op variëteit, aantal percelen en oppervlakte. Heeft een bedrijf wel percelen maar nog geen teelten, dan staat dat nu duidelijk aangegeven.",
      },
      {
        title: "Percelen ophalen of importeren bij RVO",
        body: "Bevat een shapefile voor een perceel wel een startdatum maar geen einddatum, dan kan de import niet meer vastlopen wanneer een bestaand perceel een einddatum heeft die vóór die startdatum ligt.",
      },
      {
        title: "Kleine verbeteringen",
        body: "De popup in de gewaspercelenkaart verscheen op touchscreens soms niet goed en de snedezwaarten in het bemestingsadvies per snede staan nu van licht naar zwaar.",
      },
    ],
  },
  {
    version: "v0.36.0",
    date: "2026-09-02",
    title: "Maatregeladvies, verbeterde gebruiksruimte en advies per snede",
    description:
      "Bij de BLN3-indicatoren ziet u nu welke maatregelen naar verwachting het meeste effect hebben, zodat de volgorde waarin u maatregelen oppakt onderbouwd is. De stikstofgebruiksnorm neemt voortaan ook volgteelten mee, zijn sommige kortingen voor vanggewassen, winterteelten en grasland gecorrigeerd, en bij de stikstofgebruiksnorm is de toelichting, hoe die tot stand is gekomen, verbeterd. Voor grasland is er een bemestingsadvies per snede. Daarnaast krijgt uw bedrijf een geverifieerde status wanneer u percelen ophaalt bij RVO en kunt u een overzicht vinden van de bemestingsplannen voor uw bedrijf.",
    items: [
      {
        title: "Aanbevolen maatregelen bij de BLN3-indicatoren",
        body: "Bij de maatregelen en indicatoren ziet u nu welke maatregelen naar verwachting het meeste bijdragen aan een indicator. Op de maatregelenpagina van een perceel staan aanbevelingen bovenaan en kunt u sorteren op impact; in het venster om een maatregel toe te voegen geeft een balkje de verwachte impact weer. Opent u dat venster vanuit een indicator, dan wordt op de impact voor die indicator gesorteerd. Bij elke indicator die niet groen scoort staan aanbevolen maatregelen die u in één klik kunt toevoegen. Op bedrijfsniveau laat de knelpuntenanalyse onder 'Waar te beginnen' zien welke maatregel het meest oplevert voor het hele bedrijf, gewogen naar de oppervlakte van de percelen, en onder de maatregelentabel staan de aanbevelingen gegroepeerd per maatregel met de betreffende percelen erbij. De aanbevelingen worden altijd gecontroleerd tegen de vraag of een maatregel op dat perceel van toepassing is.",
      },
      {
        title: "Bufferstroken en natuurpercelen buiten BLN3",
        body: "Bufferstroken, natuurpercelen en andere niet-landbouwkundige percelen tellen niet meer mee bij de BLN3-indicatoren, de maatregelen en de bedrijfsgemiddelden. Deze percelen zijn wel geregistreerd, maar worden niet geteeld; een bodemkwaliteitsscore ervoor zegt weinig en vertekende het beeld van het bedrijf.",
      },
      {
        title: "Stikstofgebruiksnorm per teelt",
        body: "De stikstofgebruiksnorm van een perceel is nu de som van de normen van alle teelten die in het kalenderjaar op dat perceel staan, volgens tabel 2 van RVO. Eerder werd uitsluitend gerekend met de hoofdteelt. Voor gewassen die als volgteelt worden geteeld, zoals spinazie, verschillende slasoorten, andijvie en graszaad, wordt de bijbehorende volgteeltnorm gebruikt.",
      },
      {
        title: "Voorwaarden voor groenbemesters en teelten na maïs",
        body: "Voor groenbemesters gelden nu de wettelijke voorwaarden: gezaaid vóór 1 september, staand tot ten minste 1 februari van het jaar erna en met een toegestane voorafgaande teelt (granen, koolzaad of graszaad voor de volledige norm; de helft op zand en löss na tijdelijk grasland). Groenbemesters, tijdelijk grasland en vanggewassen die direct op maïs volgen, krijgen geen gebruiksruimte, zoals de regelgeving voorschrijft.",
      },
      {
        title: "Kortingen bij vanggewassen en winterteelten herzien",
        body: "De korting op de stikstofgebruiksnorm op zand en löss is op meerdere punten gecorrigeerd. Welke gewassen als vanggewas of als winterteelt gelden, wordt nu per gewas bepaald in plaats van per gewasgroep; hierdoor gelden onder meer snijmaïs en triticale niet langer ten onrechte als winterteelt respectievelijk vanggewas, en bladrammenas-stoppelknollen wél als vanggewas. De beoordeling gaat uit van de hoofdteelt van het voorgaande jaar. Suiker- en voederbieten tellen alleen als winterteelt wanneer ze op of na 1 november zijn geoogst, en korrelmaïs, corncob mix, energiemaïs en suikermaïs alleen wanneer er een vanggewas onder is gezaaid.",
      },
      {
        title: "Kortingen bij graslandvernieuwing en -vernietiging",
        body: "De periode voor graslandvernieuwing loopt van 1 juni tot en met 31 augustus. Op klei en veen gold de korting in 2025 alleen voor bedrijven met een derogatievergunning; vanaf 2026 geldt deze op alle grondsoorten. Vindt vernietiging plaats buiten de toegestane periode, dan wordt de korting niet toegepast in plaats van dat de berekening afbreekt. De korting voor vanggewassen en winterteelten en die voor graslandvernieuwing en -vernietiging worden nu bij elkaar opgeteld wanneer beide van toepassing zijn.",
        correction: {
          version: "v0.39.0",
          text: "In 2026 gelden de kortingen voor graslandvernieuwing en -vernietiging alleen op zand en löss, niet op klei en veen.",
        },
      },
      {
        title: "Toelichting bij de gebruiksnormen",
        body: "Op de normenpagina van een perceel staat per norm hoe die is berekend en welke voetnoten en voorwaarden daarbij zijn toegepast, zodat u een uitkomst kunt herleiden. Bemestingen worden daar getoond in de eenheid die bij de meststof hoort. De toelichting over onderdelen van de Meststoffenwet die de applicatie nog niet ondersteunt, staat nu in beeld bovenaan de pagina en is uit te klappen wanneer u die wilt lezen.",
      },
      {
        title: "Bemestingsadvies per snede voor grasland",
        body: "Op de adviespagina van een grasperceel staat een kaart 'Advies per snede' met een regel per snede. Per snede wordt de passende snedezwaarte gekozen en volgen het advies en de stikstofvulling die keuze. Voor sneden die al geoogst zijn, wordt de snedezwaarte afgeleid uit de vastgelegde droge-stofopbrengst en ziet u de oogstdatum en de opbrengst in kg ds per hectare. De stikstofvulling per snede wordt getoond voor elk jaar waarin oogsten zijn vastgelegd; in het huidige jaar is de eerstvolgende snede gemarkeerd.",
      },
      {
        title: "Verbeteringen op de adviespagina van een perceel",
        body: "Bij de nutriënten staat het verschil met het advies nu in kilogrammen ('-25 kg' of '+35 kg') in plaats van als percentage. Voor sporenelementen worden twee decimalen getoond, bij een advies van nul ziet u het overschot, en voor een nutriënt zonder bemestingen staat er een knop 'Toevoegen'. Kan het advies niet berekend worden, dan krijgt u een melding op de pagina zelf in plaats van een foutpagina.",
      },
      {
        title: "Geverifieerde relatie met uw bedrijf",
        body: "Haalt u uw percelen op bij RVO via eHerkenning, dan wordt vastgelegd dat u aantoonbaar bij dit bedrijf hoort. Uw bedrijf krijgt daarmee een geverifieerde status, en op de pagina Toegang ziet u welke gebruikers een geverifieerde relatie met het bedrijf hebben. Zolang die verificatie geldt, kan het KvK-nummer van het bedrijf niet meer worden gewijzigd, zodat het nummer waarop de verificatie berust niet kan gaan afwijken.",
      },
      {
        title: "Duidelijkere melding bij het ophalen van percelen bij RVO",
        body: "Wanneer u niet gemachtigd bent voor het opgegeven KvK-nummer, wordt dat nu als zodanig gemeld in plaats van als een algemene storing.",
      },
      {
        title: "Bemestingsplan bekijken en bewaren",
        body: "Een gegenereerd bemestingsplan kunt u nu in de applicatie bekijken voordat u het downloadt. Het plan wordt bewaard en opnieuw opgesteld zodra de onderliggende gegevens zijn gewijzigd, zodat u niet met een verouderde versie werkt.",
      },
      {
        title: "Bedrijfsdashboard volgt het gekozen jaar",
        body: "Het aantal percelen, de totale oppervlakte en het bemestingsadvies op het bedrijfsdashboard horen nu bij het jaar dat u heeft geselecteerd, in plaats van bij het huidige kalenderjaar.",
      },
      {
        title: "'Oogst' bij graszaad",
        body: "Bij grasgewassen die één keer worden geoogst, zoals graszaad, spreekt de applicatie van 'oogst' in plaats van 'snede'. Graszaden staan nu ook als eenmalig oogstbaar in de gewascatalogus.",
      },
      {
        title: "Variëteiten alfabetisch gesorteerd",
        body: "In de bouwplantabel en bij het aanmaken van een bedrijf staan de variëteiten van een gewas alfabetisch gesorteerd, wanneer er variëteiten beschikbaar zijn.",
      },
      {
        title: "Minteken bij aftrekkende BCS-indicatoren",
        body: "Plasvorming, Scheuren en Spoorvorming worden nu met een minteken weergegeven op de detailpagina van de BodemConditieScore, in het indicatorenvenster van een perceel en in de invoerwizard. Zo is duidelijk dat deze indicatoren van de totaalscore worden afgetrokken.",
      },
      {
        title: "Atlas opent in het huidige jaar",
        body: "De Atlas, de hoogtekaart en de bodemkaart openden vanaf de bedrijvenpagina in het laatst beschikbare kalenderjaar, dat in de toekomst kan liggen. Ze openen nu in het huidige jaar, zodat u niet in een jaar zonder percelen terechtkomt.",
      },
    ],
  },
  {
    version: "v0.35.0",
    date: "2026-07-30",
    title: "Perceeldashboard, Renure, NLV en een Tijdlijn",
    description:
      "Elk perceel heeft nu een dashboard waarop kaart, teelten, bemesting, gebruiksruimte, balansen, bodem, indicatoren en maatregelen bij elkaar staan. Renure is toegevoegd aan de gebruiksruimte en de meststoffen, en op de nieuwe Tijdlijn ziet u alle activiteiten op uw percelen in de tijd. Daarnaast helpt de Teeltassistent bij percelen zonder geregistreerde hoofdteelt, is het stikstofleverend vermogen (NLV) toegevoegd en zijn de bodempagina, het bemestingsadvies en het inloggen op onderdelen verbeterd.",
    items: [
      {
        title: "Perceeldashboard",
        body: "Wanneer u een perceel opent, komt u nu op een dashboard in plaats van direct op een onderliggende pagina. Hierop staan de kaart van het perceel, de huidige teelt en de teelthistorie (uit de applicatie en uit de BRP), de bemestingen en het bemestingsadvies, de gebruiksruimte, de stikstof- en organische stofbalans, de bodemparameters, bodemanalyses en BodemConditieScore, de BLN-indicatoren en de maatregelen. Elk onderdeel verwijst door naar de bijbehorende pagina, zodat u vanaf één plek verder kunt.",
      },
      {
        title: "Renure bij gebruiksruimte en meststoffen",
        body: "Renure zijn stikstofmeststoffen die uit dierlijke mest zijn teruggewonnen. Vanaf 2026 geldt hiervoor een aparte gebruiksnorm van 80 kg stikstof per hectare, bovenop de norm van 170 kg stikstof per hectare uit dierlijke mest. Voor 2026 en later ziet u deze norm als vierde norm bij de gebruiksruimte; voor eerdere jaren tellen deze meststoffen mee als dierlijke mest, zoals de regelgeving voorschrijft. Aan de standaardcatalogus zijn vier Renure-meststoffen toegevoegd (ammoniumsulfaatoplossing, ammoniumnitraatoplossing, mineralenconcentraat en ammoniumstruviet) en daarnaast ammoniumstruviet en kaliumstruviet zonder Renure-classificatie. Nieuwe meststoffen uit de catalogus worden voortaan ook automatisch beschikbaar gesteld aan bestaande bedrijven; voorheen zagen alleen nieuw aangemaakte bedrijven ze.",
      },
      {
        title: "Stikstofleverend vermogen (NLV)",
        body: "Het stikstofleverend vermogen van de bodem, de stikstof die vrijkomt uit de organische stof, wordt nu berekend en getoond bij de bodemparameters, op het perceeldashboard, in de percelentabel en als kaartlaag bij de bodemanalyses in de Atlas.",
      },
      {
        title: "Tijdlijn van uw bedrijf",
        body: "Op de nieuwe pagina 'Tijdlijn' ziet u in één overzicht wanneer welke teelten, bemestingen, oogsten en bodembemonsteringen op uw percelen hebben plaatsgevonden. U kunt in- en uitzoomen en filteren. Op een telefoon of een smal scherm wordt de Tijdlijn getoond als een lijst met gebeurtenissen op datum, met filters op maand en jaar en de mogelijkheid om per perceel te groeperen.",
      },
      {
        title: "Snellere navigatie naar percelen",
        body: "Onderaan het onderdeel Bedrijf in de zijbalk staat nu een uitklapbare groep 'Perceel' met de pagina's van het perceel waar u mee bezig bent. Klikt u in de zijbalk op een bedrijfsonderdeel (zoals Kalender, Percelen, Bouwplan, Maatregelen of Meststoffen) terwijl er nog geen bedrijf actief is, bijvoorbeeld op de bedrijvenpagina, dan verschijnt een venster waarin u een bedrijf kiest en gaat u daarna direct naar de gevraagde pagina. Bij 'Kies een perceel' wordt ook gevraagd om welk perceel het gaat en gaat u meteen naar dat perceel.",
      },
      {
        title: "Teeltassistent bij ontbrekende hoofdteelt",
        body: "Voor percelen waarvoor u nog geen hoofdteelt heeft vastgelegd, wordt nu een gewas voorgesteld op basis van een schatting uit de BRP. Het voorstel verschijnt op het bedrijfsdashboard, in de perceelslijst, op de perceelpagina en bij het bemestingsadvies. U kunt het voorstel in één stap overnemen, waarbij u het eerst in een venster kunt controleren, of het formulier laten voorinvullen en zelf aanpassen. Zonder hoofdteelt kunnen de gebruiksnormen en het bemestingsadvies niet worden bepaald; deze functie helpt die percelen op te sporen. Wanneer geen schatting beschikbaar is, blijft het voorstel eenvoudigweg achterwege.",
      },
      {
        title: "Bodemanalyse-PDF later terugkijken",
        body: "Een PDF van een bodemanalyse die u uploadt wordt nu bewaard. U kunt de oorspronkelijke bodemanalyse daardoor later in de applicatie inzien en downloaden naast de ingelezen waarden, zodat de herkomst van een meetwaarde controleerbaar blijft. Verwijdert u de bodemanalyse, dan wordt ook de PDF verwijderd.",
      },
      {
        title: "Maatregelen die niet van toepassing zijn",
        body: "In de lijst met maatregelen kunt u maatregelen die niet of nog niet van toepassing zijn niet meer selecteren. Er wordt bij vermeld waarom een maatregel niet op het perceel van toepassing is. Op bedrijfsniveau ziet u voor hoeveel percelen een maatregel van toepassing is wanneer dat er niet alle zijn.",
      },
      {
        title: "Bemestingsadvies als tabel",
        body: "Het bemestingsadvies op bedrijfsniveau is vervangen door een doorzoekbare en sorteerbare tabel met alle percelen en nutriënten naast elkaar. U kunt wisselen tussen weergave per hectare en totalen, ziet de totalen voor het bedrijf, en het is nu duidelijker aangegeven voor welke percelen geen advies berekend kon worden.",
      },
      {
        title: "Bepaling van de hoofdteelt gelijkgetrokken",
        body: "De hoofdteelt wordt nu overal in de applicatie bepaald aan de hand van de teelt die het perceel tussen 15 mei en 15 juli in gebruik heeft, zoals de regelgeving voorschrijft. Op sommige plaatsen werd hiervoor eerder gekeken of een teelt op 15 mei actief was, wat tot afwijkende uitkomsten kon leiden.",
      },
      {
        title: "Profielfoto en organisatielogo",
        body: "U kunt nu een profielfoto uploaden en organisaties kunnen een logo uploaden. Foto's en logo's kunnen ook weer worden verwijderd, ook wanneer ze eerder via een social login zijn overgenomen.",
      },
      {
        title: "Inloggen met een code van zes cijfers",
        body: "De code die u per e-mail ontvangt bij het aanmelden bestaat nu uit zes cijfers in plaats van acht letters en cijfers. Op een telefoon verschijnt daardoor een numeriek toetsenbord en typt u de code sneller in. U kunt nu ook zelf een nieuwe code aanvragen wanneer de eerste niet aankomt. Verder is het aanmeldscherm verbeterd op het gebied van toegankelijkheid en formulering.",
      },
      {
        title: "Bodempagina overzichtelijker",
        body: "De tabbladen op de bodempagina van een perceel zijn vervangen door een indeling in twee kolommen. U ziet daardoor tegelijk de meest recente waarde per bodemparameter en de lijst met bodemanalyses.",
      },
      {
        title: "Percelen en teelten van 2026",
        body: "In de Atlas zijn de voorlopige percelen van 2026 beschikbaar en zijn de percelen van 2025 definitief geworden. De nieuwe teelten van 2026 zijn opgenomen in de gewascatalogus, met de bijbehorende stikstofgebruiksnormen. Deze wijzigingen zijn eerder deze maand al beschikbaar gesteld.",
      },
      {
        title: "Vragen per e-mail komen in de helpdesk terecht",
        body: "Vragen die u per e-mail aan de ondersteuning stelt, worden nu automatisch als ticket aangemaakt en uw antwoorden komen onder hetzelfde ticket te staan in plaats van als een nieuwe vraag. Maakt u later een account aan met hetzelfde e-mailadres, dan vindt u deze eerdere vragen terug in de helpdesk.",
      },
      {
        title: "Uitnodigingen zichtbaar voor organisatieleden",
        body: "Leden van een organisatie zien nu ook de openstaande uitnodigingen voor hun organisatie. Kunt u een uitnodiging niet zelf accepteren of weigeren, dan wordt vermeld dat uw beheerder dit kan doen.",
      },
      {
        title: "Consistente kleuren bij gebruiksnormen en advies",
        body: "De balken van de gebruiksnormen en van het bemestingsadvies worden nu overal op dezelfde manier gekleurd. Bij gebruiksnormen is de balk groen binnen de norm en rood daarboven; bij het bemestingsadvies oranje onder 90%, groen tussen 90% en 110% en rood boven 110%.",
      },
      {
        title: "Duidelijker onderscheid bij foutmeldingen",
        body: "Wanneer een pagina niet bestaat of u er geen toegang toe heeft, ziet u nu een andere pagina dan bij een storing. Zo is beter te zien of het om een vergissing of om een probleem aan onze kant gaat.",
      },
      {
        title: "Verbeteringen in het overzicht",
        body: "De bedrijvenpagina en de bedrijfspagina zijn iets overzichtelijker ingedeeld.",
      },
      {
        title: "Foutmelding bij het aanmaken van een teelt",
        body: "Voert u bij een nieuwe teelt een einddatum in die vóór de startdatum ligt, dan ziet u de foutmelding nu direct bij het formulier. Dit werkte eerder alleen bij het aanpassen van een teelt.",
      },
      {
        title: "Klikken op de hoofdscore bij indicatoren",
        body: "Het klikken op de hoogste score in de indicatorenboom klapt de onderliggende indicatoren nu weer open en dicht.",
      },
    ],
  },
  {
    version: "v0.32.0",
    date: "2026-06-25",
    title: "BodemConditieScore, vernieuwde BLN3-weergave en een helpdesk",
    description:
      "Met de BodemConditieScore (BCS) legt u een visuele bodembeoordeling vast op de perceelpagina, inclusief foto's en notities. De BLN3-bodemkwaliteit is vernieuwd met officiële scores voor ecosysteemdiensten, een uitklapbare structuur en een knelpuntenanalyse, en is nu ook op organisatieniveau te bekijken. Daarnaast is er een helpdesk onder Ondersteuning en zijn er verbeteringen rond grasland, het uploaden van shapefiles en de navigatie.",
    items: [
      {
        title: "BodemConditieScore (BCS)",
        body: "Op de perceelpagina kunt u nu een BodemConditieScore vastleggen. Via een stapsgewijze wizard beoordeelt u de bodem aan de hand van visuele kenmerken in het veld en voegt u desgewenst foto's toe. U ziet een totaalscore met een kleur en label (van Slecht tot Zeer goed) en de scores per indicator. Foto's kunt u voorzien van notities. Op mobiel kunt u direct een foto maken of er een uit uw galerij kiezen. Waar bodemanalyses beschikbaar zijn, worden ook pH- en organische-stofscores afgeleid.",
      },
      {
        title: "BLN3-bodemkwaliteit vernieuwd",
        body: "De weergave van de BLN-scores is herzien. In plaats van eigen, benaderende gemiddelden worden nu de officiële aggregatiescores van de NMI getoond. Met een uitklapbare structuur klikt u van de hoofdscore door naar onderliggende categorieën tot aan de afzonderlijke indicatoren. Een nieuwe 'Knelpuntenanalyse' laat zien welke onderdelen op uw bedrijf het zwakst scoren en welke percelen daar het meest aan bijdragen, met directe links naar de betreffende percelen. Bij de satellietkaart kunt u nu ook kiezen om de score voor ecosysteemdiensten weer te geven, en de uitgebreide indicatorentabel staat nu onder een uitklapknop.",
      },
      {
        title: "BLN3 op organisatieniveau",
        body: "Organisaties kunnen nu een overzicht zien van de BLN3-indicatoren en -maatregelen van de bedrijven waartoe zij toegang hebben. U ziet de gemiddelde indicatoren per bedrijf en kunt vanuit een perceel doorklikken naar de atlas van dat bedrijf. De organisatie-indicatorenpagina toont de opbouw van de scores en de vijf zwakst scorende bedrijven; de maatregelenpagina toont alle maatregelen van de bedrijven, met snelle navigatie naar het betreffende bedrijf.",
      },
      {
        title: "Helpdesk onder Ondersteuning",
        body: "Onder het tabblad Ondersteuning is een helpdesk toegevoegd voor het stellen van vragen, doorgeven van bugs en het geven van feedback. U kunt tickets aanmaken en terugvinden, en uw eigen tickets doorzoeken en sorteren op onder meer prioriteit, aanmaakdatum en labels. Medewerkers kunnen tickets toewijzen, prioriteren, van labels voorzien en categoriseren.",
      },
      {
        title: "Meerdere sneden tegelijk toevoegen",
        body: "Voor grasland kunt u nu meerdere sneden in één keer invoeren via een nieuwe invoermodus van het oogstformulier. Dit werkt zowel op het tabblad teelten van de perceelpagina als bij het toevoegen van een oogst vanuit de bouwplantabel.",
      },
      {
        title: "Aangepaste termen voor grasland",
        body: "Bij grasland worden nu de passendere termen 'snede' en 'maaien' gebruikt in plaats van 'oogst'.",
      },
      {
        title: "Foutmeldingen direct bij het oogstformulier",
        body: "Wanneer een oogst niet kan worden opgeslagen vanwege een controle op de server, ziet u de foutmelding nu direct bij het betreffende veld in het formulier.",
      },
      {
        title: "Controle op het jaar bij shapefiles",
        body: "Als u een shapefile uploadt met percelen waarvan de startdatum na het geselecteerde jaar ligt, krijgt u nu een duidelijke melding dat u waarschijnlijk het verkeerde jaar heeft gekozen, met een knop om direct naar het meest waarschijnlijke jaar te wisselen.",
      },
      {
        title: "Knop één niveau omhoog",
        body: "In de header staat nu een knop waarmee u één niveau omhoog navigeert (bijvoorbeeld van een perceel terug naar het bedrijf), wat het navigeren in geneste pagina's makkelijker maakt.",
      },
      {
        title: "Veiliger inloggen met Microsoft",
        body: "Het inloggen met Microsoft maakt nu gebruik van certificaten in plaats van een wachtwoordsleutel. Dit verbetert de beveiliging en is verder niet merkbaar bij het aanmelden.",
      },
      {
        title: "Foutmelding bij wisselen van bedrijf hersteld",
        body: "Het wisselen van bedrijf op diep geneste pagina's leidt niet langer tot een 404-foutmelding.",
      },
    ],
  },
  {
    version: "v0.31.0",
    date: "2026-05-28",
    title: `BLN3 indicatoren en maatregelen, bodemanalyses in Atlas en ${clientConfig.name} API`,
    description: `BLN3 bodemindicatoren en maatregelen zijn nu beschikbaar, bodemanalyses kunnen ruimtelijk worden verkend in Atlas en de ${clientConfig.name} API is beschikbaar voor koppelingen met externe systemen.`,
    items: [
      {
        title: "BLN3 bodemindicatoren",
        body: "Op de nieuwe indicatorenpagina ziet u de BLN3-scores voor uw bedrijf. Per perceel kunt u de individuele indicatorscores bekijken om inzicht in de bodemkwaliteit te krijgen.",
      },
      {
        title: "BLN3 maatregelen",
        body: "Bij de indicatoren kunt u maatregelen bekijken die bijdragen aan het verbeteren van de bodemkwaliteit. U kunt aangeven welke maatregelen u nu kiest.",
      },
      {
        title: "Bodemanalyse in Atlas",
        body: "De Atlas bevat nu een weergave voor bodemanalyses. Hiermee kunt u de resultaten van uw bodemanalyses ruimtelijk verkennen over uw percelen.",
      },
      {
        title: "Hoofdgewas naast perceelsnaam bij bedrijfsbalans",
        body: "De perceelslijst op de balanspagina toont nu een badge met het hoofdgewas per perceel, zodat u in één oogopslag ziet welk gewas op welk perceel staat.",
      },
      {
        title: `${clientConfig.name} API en ontwikkelaarsinstellingen`,
        body: `De ${clientConfig.name} API is beschikbaar voor koppelingen met externe systemen. Via de nieuwe ontwikkelaarsinstellingen kunt u API-sleutels aanmaken en beheren voor programmatische toegang tot uw gegevens.`,
      },
      {
        title: "Bodemparameters bij alleen-lezen toegang",
        body: "Gebruikers met alleen leestoegang zien bij bodemparameters nu een link naar de bodemanalyse in plaats van een bewerkknop, zodat duidelijker is dat de waarden niet bewerkt kunnen worden.",
      },
      {
        title: "Waarschuwing bij ontbrekende normen",
        body: "Wanneer voor een perceel geen gebruiksnormen bepaald kunnen worden, wordt dit nu duidelijk gemeld zodat u weet waarom bepaalde berekeningen niet beschikbaar zijn.",
      },
    ],
  },
  {
    version: "v0.30.0",
    date: "2026-05-01",
    title: "Percelen ophalen bij RVO, bemesting in de eenheid die past bij de meststof en meer",
    description:
      "Het ophalen van percelen bij RVO is nu mogelijk door middel van eHerkenning en KvK nummer. Een bemesting wordt nu ingevoerd en weergegeven in de eenheid die past bij de meststof. Shapefiles kunt u nu ook uploaden nadat een bedrijf is aangemaakt.",
    items: [
      {
        title: "Percelen ophalen vanuit RVO",
        body: "Het ophalen van percelen vanuit RVO via eHerkenning is nu beschikbaar. Hiermee kunt u wanneer u gemachtigd bent en het KvK nummer hebt ingevuld de percelen ophalen die bij RVO zijn opgegeven voor de Gecombineerde Opgave. Dit kan zowel voor bestaande bedrijven in de applicatie als bij het aanmaken van een nieuw bedrijf.",
      },
      {
        title: "Bemesting in de eenheid die past bij de meststof",
        body: "U hoeft een bemesting niet meer altijd in kg/ha in te voeren. Vloeibare meststoffen voert u nu in m³/ha in, compost in ton/ha, enzovoort. De ingevoerde en getoonde eenheid sluit aan bij de meststof, zodat u niet meer hoeft om te rekenen.",
      },
      {
        title: "Shapefiles uploaden bij een bestaand bedrijf",
        body: "Het uploaden van een shapefile met percelen is niet langer alleen mogelijk bij het aanmaken van een nieuw bedrijf, maar ook daarna via de bedrijfspagina. In een vergelijkingstabel ziet u welke percelen worden toegevoegd, gewijzigd of verwijderd, zodat u de wijzigingen kunt beoordelen voordat u ze samenvoegt. De werkwijze sluit aan bij die van het ophalen van percelen via RVO.",
      },
      {
        title: "Uitgebreide gewashistorie in Atlas",
        body: "Op de detailpagina van een perceel in de Atlas kunt u nu kiezen tussen het tabblad 'Eenvoudig' en het tabblad 'Uitgebreid'. Het uitgebreide tabblad toont in een ruimtelijk stroomdiagram welke teelten in eerdere jaren op de geometrie van het huidige perceel hebben gelegen. Omdat percelen in voorgaande jaren anders ingedeeld kunnen zijn geweest (bijvoorbeeld als één groter perceel of juist als meerdere kleinere), maakt deze weergave inzichtelijk welke teelten op welk deel van de huidige geometrie hebben gestaan. Uw keuze van tabblad blijft tijdens de sessie bewaard.",
      },
      {
        title: "Filter op bufferstroken",
        body: "Het filter voor bufferstroken in de bouwplantabel werkt weer. De zoekterm en de keuze van dit filter worden nu gedeeld tussen de bouwplan- en perceelstabel, zodat de tabellen consistent met elkaar blijven.",
      },
      {
        title: "Sortering meerdere sneden",
        body: "De sortering van sneden binnen een jaar wordt nu correct weergegeven in de bouwplantabel.",
      },
      {
        title: "Gewashistorie op jaar gesorteerd",
        body: "De gewashistorie van een perceel in de Atlas wordt nu aflopend op jaar gesorteerd weergegeven.",
      },
      {
        title: "Gewasresten achterlaten alleen bij granen",
        body: "Het invulveld 'Gewasresten achterlaten' wordt alleen getoond wanneer dit relevant is voor het geselecteerde gewas, namelijk bij granen.",
      },
      {
        title: "Atlas-perceelselectie scrollbaar",
        body: "Op pagina's waar u percelen op de kaart selecteert is de lijst met geselecteerde gewassen nu scrollbaar wanneer er veel gewassen in zitten. Hierdoor blijft de knop 'Sla geselecteerde percelen op' altijd bereikbaar.",
      },
      {
        title: "Inloggen met Microsoft zonder e-mailadres",
        body: "Als Microsoft bij het aanmelden geen e-mailadres deelt met FDM, wordt u nu gevraagd in te loggen via een aanmeldlink in plaats van een onduidelijke foutmelding te krijgen.",
      },
      {
        title: "Foutmelding 'Not a FlatGeobuf file' in Atlas",
        body: "Een hardnekkige foutmelding die kon optreden door een verouderde browsercache wordt nu automatisch hersteld zonder dat u zelf actie hoeft te ondernemen.",
      },
      {
        title: "Correctie organische stofbalans bij gewasresten",
        body: "De organische stofbalans rekent nu ook correct met gewasresten waarvan niet expliciet is vastgelegd dat ze van het perceel zijn afgevoerd; eerder werd in dat geval ten onrechte geen aanvoer berekend.",
      },
      {
        title: "Prestatieverbeteringen voor grote bedrijven",
        body: "Pagina's en berekeningen voor bedrijven met veel percelen laden sneller en betrouwbaarder, onder meer bij de stikstofbalans en bij het ophalen van depositiegegevens. Ook krijgt het samenstellen van een pagina meer tijd voordat er een time-out optreedt.",
      },
    ],
  },
  {
    version: "v0.29.0",
    date: "2026-04-02",
    title:
      "Verbeterd meststoffenbeheer, balansoverzicht per organisatie en bufferstrook in perceelstabel",
    description:
      "Deze release vernieuwt de weergave en het beheer van meststoffen, voegt een stikstof- en organische stofbalansoverzicht op organisatieniveau toe en maakt het instellen van bufferstroken per perceel eenvoudiger.",
    items: [
      {
        title: "Verbeterd meststoffenbeheer",
        body: "De meststoffenpagina en het formulier voor het toevoegen van een meststof zijn vernieuwd. De tabel toont nu aanvullende nutriënten en eigenschappen zoals DS, OS, MgO, CaO, Na₂O, SO₃ en sporenelementen. Via de knop 'Kolommen' kiest u zelf welke kolommen u wilt zien. Het selecteren van een catalogusmeststof gaat nu via een doorzoekbare lijst in plaats van een grid van meststoffen. Standaard- en eigen meststoffen zijn visueel van elkaar onderscheiden. De invoervelden in het formulier zijn overzichtelijker ingedeeld. De zijbalk berekent de werkzame stikstof direct terwijl u gegevens invult.",
      },
      {
        title: "Meststof als sjabloon gebruiken",
        body: "Via de optie 'Gebruik als sjabloon' maakt u direct een nieuwe meststof aan op basis van een bestaande meststof vanuit de detailpagina. De rijen in de meststoftabel zijn nu klikbaar en brengen u direct naar de detailpagina.",
      },
      {
        title: "Balansoverzicht op organisatieniveau",
        body: "De stikstofbalans en organische stofbalans zijn nu ook beschikbaar op organisatieniveau. In één overzicht ziet u de resultaten voor alle bedrijven in de organisatie. U kunt individuele bedrijven uitsluiten van het overzicht.",
      },
      {
        title: "Bufferstrook instellen per perceel",
        body: "In de perceelstabel is een kolom met aankruisvakjes toegevoegd waarmee u per perceel kunt aangeven of het een bufferstrook is, zonder naar de afzonderlijke perceelspagina te navigeren.",
      },
      {
        title: "Gewasresten",
        body: "De optie om gewasresten in te voeren is niet zichtbaar als dat niet relevant voor het geselecteerde gewas is. Dit voorkomt het invoeren van gegevens die geen effect hebben op de organische stofbalans.",
      },
      {
        title: "Focusknop in Atlas",
        body: "Er is een knop toegevoegd waarmee u de kaart in de Atlas direct kunt centreren op de percelen van uw bedrijf. Tijdens het toevoegen van percelen wordt het focusgebied automatisch bijgewerkt wanneer u een nieuw perceel selecteert.",
      },
      {
        title: "Correctie stikstofafvoer gewasresten",
        body: "Een fout in de stikstofbalans is hersteld. Gewasresten die op het perceel achterblijven worden niet langer als afgevoerde stikstof meegenomen; gewasresten die worden afgevoerd worden nu meegenomen in de afvoer.",
      },
      {
        title: "Prestatieverbeteringen",
        body: "Pagina's en berekeningen voor grote bedrijven laden sneller doordat gegevens per bedrijf in één databasequery worden opgehaald in plaats van per perceel.",
      },
    ],
  },
  {
    version: "v0.28.0",
    date: "2026-03-04",
    title: "Meerdere bodemanalyses uploaden, direct bewerken in bouwplantabel en uitnodigingen",
    description:
      "U kunt nu meerdere bodemanalyse-PDF's tegelijk uploaden en direct beoordelen voordat u ze koppelt aan een perceel. Oogsten en mestgiften zijn direct in de bouwplantabel te bewerken. Daarnaast kunt u mensen uitnodigen voor een bedrijf, ook als ze nog geen account hebben.",
    items: [
      {
        title: "Meerdere bodemanalyses tegelijk uploaden",
        body: "Bij het toevoegen van percelen kunt u meerdere PDF's van bodemanalyses tegelijk uploaden. De gegevens worden in een tabel getoond zodat u kunt controleren welke waarden worden ingeladen voordat u ze koppelt aan een perceel. Op de pagina staat nu ook duidelijk vermeld dat de ingeladen waarden schattingen zijn.",
      },
      {
        title: "Direct bewerken van oogsten in het bouwplan",
        body: "U kunt de oogstdatum en oogstparameters nu direct aanpassen vanuit de bouwplantabel, zonder naar een aparte pagina te navigeren.",
      },
      {
        title: "Bemestingen bekijken en bewerken via het bouwplan en perceelstabel",
        body: "Door op een meststof in de bouwplan of perceelstabel te klikken ziet u een overzicht van alle bemestingen met die meststof op het geselecteerde gewas of perceel. U kunt de giften direct vanuit dit overzicht aanpassen.",
      },
      {
        title: "Uitnodigingen voor toegang tot bedrijven",
        body: "Wanneer iemand u toegang geeft tot een bedrijf, ontvangt u voortaan een e-mail met een uitnodiging. U kunt deze uitnodiging zelf accepteren of weigeren via de overzichtspagina. Uitnodigingen zijn 7 dagen geldig. Ook gebruikers die nog geen account hebben kunnen worden uitgenodigd; zij krijgen automatisch toegang zodra zij zich registreren met hetzelfde e-mailadres.",
      },
      {
        title: "Uitnodigingen beheren",
        body: "Als eigenaar of beheerder van een bedrijf kunt u uitstaande uitnodigingen inzien, annuleren of de rol van een uitnodiging aanpassen, rechtstreeks vanuit de instellingenpagina van het bedrijf.",
      },
      {
        title: "Bodemanalyses van eerdere jaren",
        body: "De lijst met bodemanalyses bij een perceel toont nu ook analyses van vóór het geselecteerde jaar, zodat u eerdere metingen niet meer kwijt bent als u een ander jaar selecteert.",
      },
      {
        title: "Bodemparameters overzichtelijker ingedeeld",
        body: "De bodemparameters op de perceelspagina zijn nu gegroepeerd en in een logischere volgorde geplaatst voor een beter overzicht.",
      },
      {
        title: "Koolstofvastlegging in Atlas",
        body: "Op de detailpagina van een perceel in de Atlas is een nieuw blok toegevoegd met informatie over koolstofvastlegging. U ziet de huidige schatting van het koolstofgehalte in de bodem, het maximaal haalbare niveau en cijfers om de waarden in perspectief te plaatsen voor bijvoorbeeld extra mineralisatie en watervasthoudend vermogen.",
      },
      {
        title: "Verbeterd ontwerp perceeldetails in Atlas",
        body: "De detailpagina van een perceel in de Atlas is overzichtelijker ingedeeld en werkt nu ook goed op kleinere schermen.",
      },
      {
        title: "Terugknop op perceeldetails in Atlas",
        body: "Er is een zwevende terugknop toegevoegd onderaan de perceeldetailpagina in de Atlas, zodat u eenvoudig terug naar de kaart kunt navigeren.",
      },
      {
        title: "Organisatiegegevens bewerken en leden toevoegen",
        body: "Via de instellingenpagina van uw organisatie kunt u nu de gegevens van uw organisatie bewerken en nieuwe leden uitnodigen.",
      },
      {
        title: "Overzicht van bedrijven per organisatie",
        body: "In het organisatieoverzicht is een nieuwe tabel toegevoegd met alle bedrijven waar uw organisatie toegang toe heeft. De tabel is doorzoekbaar.",
      },
      {
        title: "Verbeterd aanmaken van bedrijf",
        body: "Bij het aanmaken van een nieuw bedrijf vraagt het formulier nu ook naar het KvK-nummer, de beweidingsintentie en de biologische certificering. Aan het begin van het stappenproces staat een toelichting op de te doorlopen stappen. De vraag over derogatie wordt alleen nog getoond voor jaren vóór 2026.",
      },
      {
        title: "Laadmelding bij trage paginaovergangen",
        body: "Als een pagina langer dan 300 milliseconden nodig heeft om te laden, verschijnt er een laadsymbool en wordt de pagina licht vervaagd. Dit voorkomt verwarring over of een actie is geregistreerd.",
      },
    ],
  },
  {
    version: "v0.27.0",
    date: "2026-01-29",
    title: "Bemestingsplan als pdf, Bodemkaart in Atlas en uitklapbaar bouwplan",
    description:
      "De eerste release van 2026 maakt het mogelijk om het bemestingsplan als pdf te downloaden, voegt de bodemkaart toe aan de Atlas en maakt de bouwplantabel uitklapbaar voor meer detail. Daarnaast is er verbeterde ondersteuning voor bufferstroken.",
    items: [
      {
        title: "Bemestingsplan als PDF",
        body: "Met één druk op de knop genereert u nu een 'Bemestingsplan'. Dit PDF-bestand geeft een compleet overzicht van de bedrijfssituatie, inclusief gebruiksruimte, bemestingsadviezen en geplande bemestingen op zowel bedrijfs- als perceelsniveau.",
      },
      {
        title: "Bodemkaart in Atlas",
        body: "De Bodemkaart van Nederland (BRO) is nu beschikbaar als kaartlaag in de Atlas. Hiermee ziet u direct het bodemtype bij de percelen.",
      },
      {
        title: "Uitklapbaar bouwplan",
        body: "In de tabel voor bouwplan kunt u nu rijen uitklappen om direct te zien welke percelen bij een teelt horen. Op deze manier kunt u bijvoorbeeld percelen uitsluiten van bemesting toevoegen als u het gewas heeft geselecteerd.",
      },
      {
        title: "Bufferstroken",
        body: "U kunt nu aangeven of een perceel een bufferstrook is. Deze percelen worden automatisch uitgesloten van de stikstof- en organische stofbalans op bedrijfsniveau. De gebruiksruimte en het bemestingsadvies worden voor deze stroken op nul gezet.",
      },
      {
        title: "Meerdere percelen toevoegen",
        body: "Het is nu mogelijk om meerdere percelen aan een bestaand bedrijf toe te voegen.",
      },
      {
        title: "Gewashistorie kopiëren",
        body: "Bij de gewashistorie van een perceel in Atlas is nu een knop toegevoegd om de historie direct naar het klembord te kopiëren, zodat u ze eenvoudig kunt plakken in bijvoorbeeld Excel.",
      },
      {
        title: "Graslandvernieuwing 2025/2026",
        body: "De specifieke regels voor stikstofkorting bij het scheuren of vernieuwen van grasland zijn toegevoegd voor de jaren 2025 en 2026.",
      },
      {
        title: "Verbeteringen voor kleine schermen",
        body: "De app werkt nu nog prettiger op mobiele apparaten. Tabellen, headers en de zijbalk zijn geoptimaliseerd voor kleinere schermen.",
      },
    ],
  },
  {
    version: "v0.26.0",
    date: "2025-12-22",
    title: "Hoogtekaart in Atlas, meer details in stikstofbalans, 2026 is beschikbaar",
    description: `Deze update bereidt ${clientConfig.name} voor op 2026 met de voorlopige gebruiksnormen en voegt de AHN4 hoogtekaart toe in de Atlas. De stikstofbalans biedt nu diepgaand inzicht met interactieve grafieken en details per mestgift.`,
    items: [
      {
        title: "AHN4-hoogtekaart in Atlas",
        body: "De AHN4 hoogtekaart is nu beschikbaar in Atlas. Hiermee kunt u tot in detail het microreliëf op uw percelen analyseren, wat waardevolle inzichten geeft voor bijvoorbeeld waterhuishouding.",
      },
      {
        title: "Voorbereiding op 2026",
        body: "U kunt nu alvast aan de slag met het aanmaken van uw bedrijf en bouwplan voor 2026. De gebruiksnormen zijn voorlopig gebaseerd op de regels van 2025 (zonder derogatie), in afwachting van definitieve politieke besluitvorming.",
      },
      {
        title: "Interactieve stikstofbalans",
        body: "De grafieken voor de stikstofbalans zijn vernieuwd en interactief. Door over de balken te bewegen ziet u direct hoeveel elke bron bijdraagt aan de stikstofbalans. Ook hebben posten zoals bemesting, oogst en depositie nu duidelijke, onderscheidende kleuren.",
      },
      {
        title: "Bijdrage van bemesting in stikstofbalans",
        body: "De stikstofbalans op perceelsniveau toont nu de bijdrage van elke individuele mestgift. Door in de grafiek over de balken te bewegen, ziet u direct details zoals hoeveel stikstof deze bemesting bijdraagt, maar ook de naam van de meststof en de datum van toediening.",
      },
      {
        title: "Inloggen met een code",
        body: "Het inloggen via de aanmeldlink is verbeterd. In de e-mail die u dan ontvangt staat een code die u kunt gebruiken om in te loggen. Daarnaast bevat de mail nog steeds een knop om in te loggen en wordt de code al voor u ingevuld.",
      },
      {
        title: "Bemestingsadvies per gewas",
        body: "Het bemestingsadvies is nu duidelijker gespecificeerd per gewas. U kunt nu zelf het gewas selecteren waarvoor u het advies wilt inzien, wat vooral bij percelen met meerdere teelten direct inzicht geeft.",
      },
      {
        title: "Vernieuwde homepage",
        body: "De homepage is vernieuwd en uitgebreid met meer informatie over de mogelijkheden. Ook is de weergave op mobiele apparaten verder verbeterd.",
      },
      {
        title: "Overstap naar MapTiler",
        body: "We zijn overgestapt van Mapbox naar MapTiler als leverancier voor onze kaarten en zoekfuncties. MapTiler verzamelt minder gebruikersdata (geen tracking/telemetrie) en host de data binnen de EU.",
      },
    ],
  },
  {
    version: "v0.25.0",
    date: "2025-11-27",
    title: "Bouwplan, organische stofbalans en verbeterde oogstregistratie",
    description:
      "Deze update introduceert de Organische stofbalans voor inzicht in bodemgezondheid, een nieuwe bouwplanpagina voor efficiënt gewasbeheer, en voegt nitraatuitspoeling toe aan de stikstofbalans.",
    items: [
      {
        title: "Bouwplan en bulkacties",
        body: "De nieuwe bouwplanpagina biedt een centraal overzicht van alle teelten op uw bedrijf. U kunt hier niet alleen uw bouwplan inzien, maar ook direct acties uitvoeren voor meerdere percelen tegelijk, zoals het toevoegen van een bemesting of oogst voor alle percelen met hetzelfde gewas.",
      },
      {
        title: "Organische stofbalans",
        body: "Met de nieuwe 'Organische stofbalans' krijgt u inzicht in de aanvoer van effectieve organische stof (EOS) uit gewassen, gewasresten en meststoffen, en de afbraak van organische stof. Dit helpt u bij het maken van plannen voor een gezonde bodem op de lange termijn.",
      },
      {
        title: "Verbeterde oogstregistratie",
        body: "Het registreren van oogsten is slimmer en nauwkeuriger geworden. Het formulier vraagt nu specifiek om de parameters die relevant zijn voor het gekozen gewas (zoals versopbrengst, tarra, droge stof, etc.). Voor niet-oogstbare gewassen (zoals groene braak) wordt de optie om te oogsten verborgen.",
      },
      {
        title: "Nitraatuitspoeling in de stikstofbalans",
        body: "De stikstofbalans geeft nu een completer beeld door ook nitraatuitspoeling (NO3) inzichtelijk te maken, naast de al bestaande ammoniakemissie (NH3). De grafiek maakt nu ook onderscheid tussen deze twee emissiestromen.",
      },
      {
        title: "Kaartlagen beheren",
        body: "Op de kaarten is een nieuwe knop toegevoegd waarmee u de perceelslaag eenvoudig kunt verbergen of tonen, zodat u de basiskaart eronder beter kunt zien als u dat wilt.",
      },
      {
        title: "Verbeterde zijbalk",
        body: "De navigatie is verbeterd: de actieve pagina is nu duidelijk zichtbaar in de zijbalk, en u ziet direct welk bedrijf geselecteerd is en wat uw rol daarbij is.",
      },
    ],
  },
  {
    version: "v0.24.0",
    date: "2025-11-03",
    title: "Inzicht in bemesting, invulling van gebruiksruimte en meer",
    description:
      "Deze update introduceert een nieuw overzicht van gebruiksruimte, stikstofbalans en bemestingsadvies op de bemestingspagina, voegt de mogelijkheid toe om biologische certificering en beweidingsintentie vast te leggen, en verbetert de weergave van meststoffen.",
    items: [
      {
        title: "Overzicht van gebruiksruimte, stikstofbalans en bemestingsadvies",
        body: "Op de pagina met toegediende mestgiften voor een perceel wordt nu een uitgebreid overzicht getoond van de gebruiksruimte, de stikstofbalans en het bemestingsadvies. Dit geeft u in één oogopslag inzicht in de actuele stand van zaken voor uw perceel.",
      },
      {
        title: "Opvulling van de gebruiksruimte",
        body: "Naast het berekenen van de gebruiksruimte voor stikstof, fosfaat en dierlijke mest, wordt nu ook de opvulling via bemesting berekend. Hierbij kunt u nu ook op perceelsniveau voor elke bemesting zien hoeveel deze bijdraagt per norm.",
      },
      {
        title: "Biologische bedrijven",
        body: "U kunt nu vastleggen of een bedrijf een biologisch (Skal) certificaat heeft. Dit heeft namelijk invloed op de invulling van de gebruiksruimte en wordt nu meegenomen in de berekening.",
      },
      {
        title: "Beweidingsintentie",
        body: "Geef per jaar aan of u van plan bent om uw dieren te weiden. Deze informatie wordt gebruikt om de stikstofgebruiksnormen voor grasland correct te berekenen.",
      },
      {
        title: "Toegediende mestgiften bewerken",
        body: "Het is nu mogelijk om eerder ingevoerde mestgiften te bewerken. Hierdoor hoeft u niet eerst een bemesting te verwijderen en daarna toe te voegen, maar kan het eenvoudig worden bijgewerkt.",
      },
      {
        title: "Verbeterd ontwerp van mestgiften",
        body: "De weergave van toegediende meststoffen is overzichtelijker gemaakt door het gebruik van iconen voor het type meststof en een betere uitlijning van de gegevens.",
      },
      {
        title: "Mestcode (RVO) als kenmerk van een meststof",
        body: "Bij het toevoegen van een meststof wordt nu de officiële RVO-mestcode gebruikt in plaats van het algemene 'Meststoftype'. Dit zorgt voor een betere aansluiting bij de regelgeving.",
      },
      {
        title: "Verbeterde weergave van mestcodes",
        body: "In de lijst met toegediende meststoffen wordt de RVO-mestcode nu gekleurd weergegeven op basis van het type meststof, wat de leesbaarheid ten goede komt.",
      },
      {
        title: "Verbeterde foutafhandeling bij de stikstofbalans",
        body: "Als de berekening van de stikstofbalans voor een specifiek perceel mislukt, worden de resultaten voor de andere percelen en het bedrijfsniveau nog steeds weergegeven.",
      },
      {
        title: "Prestatieverbeteringen",
        body: "De berekeningen voor de gebruiksnormen en de stikstofbalans zijn aanzienlijk versneld door het gebruik van caching. Dit zorgt voor een snellere en soepelere gebruikerservaring.",
      },
    ],
  },
  {
    version: "v0.23.0",
    date: "2025-09-29",
    title: "Nieuw perceelsoverzicht, bedrijf verwijderen en meer",
    description:
      "Deze update introduceert een geavanceerde perceelstabel met zoek- en selectiemogelijkheden, maakt het mogelijk om een bedrijf te verwijderen, en diverse verbeteringen voor een efficiënter beheer van uw percelen en bemesting.",
    items: [
      {
        title: "Geavanceerde perceelstabel",
        body: "Er is een nieuwe pagina toegevoegd met een geavanceerde tabel voor de percelen van uw bedrijf. Deze tabel biedt uitgebreide zoekmogelijkheden (op perceelnaam, teelten en meststoffen) en de mogelijkheid om meerdere percelen te selecteren voor het toedienen van een mestgift.",
      },
      {
        title: "Bedrijf verwijderen",
        body: "U kunt nu een bedrijf direct verwijderen vanaf de instellingenpagina van het bedrijf. Dit kan alleen als u de rol Eigenaar hebt voor het bedrijf.",
      },
      {
        title: "Nieuw dashboard",
        body: "Er is een nieuw dashboard voor uw bedrijf toegevoegd. Hier vindt u een overzicht van uw bedrijf met snelle links naar apps, pagina's en belangrijke acties.",
      },
      {
        title: "Bemesting toepassen op meerdere percelen",
        body: "Een nieuwe, speciale pagina maakt het mogelijk om een mestgift op meerdere percelen tegelijk toe te passen.",
      },
      {
        title: "Eigen meststof toevoegen vanuit het bemestingsformulier",
        body: "Vanaf het formulier voor het toedienen van een mestgift kunt u nu eenvoudig navigeren naar een nieuwe pagina om een eigen meststof toe te voegen. Na succesvol toevoegen wordt u automatisch teruggestuurd naar het bemestingsformulier.",
      },
      {
        title: "Filter op bufferstroken",
        body: "Een nieuwe schakelaar stelt u in staat om op verschillende pagina's alle percelen of alleen de percelen zonder bufferstroken te tonen, voor een meer gericht overzicht.",
      },
      {
        title: "Sortering van percelen",
        body: "Percelen worden nu gesorteerd op aflopende oppervlakte in plaats van op alfabetische naam.",
      },
      {
        title: "Verbeterde sortering in het bouwplan",
        body: "In de wizard voor het aanmaken van een bedrijf worden de teelten in het bouwplan nu gesorteerd op aflopende totale oppervlakte.",
      },
      {
        title: "Kaart centreert op geselecteerd perceel",
        body: "Bij het beoordelen van nieuw aangemaakte percelen of het bekijken van individuele percelen op de kaart, centreert de kaart nu automatisch op het geselecteerde perceel.",
      },
      {
        title: "Verbeterde uitnodigingen voor organisaties",
        body: "E-mails met uitnodigingen voor organisaties bevatten nu directe knoppen voor accepteren en weigeren.",
      },
      {
        title: "Tijdzone in aanmeldlinks",
        body: "De tijdstempel in e-mails met een aanmeldlink toont nu, indien mogelijk, de eigen tijdzone van de gebruiker voor meer duidelijkheid.",
      },
      {
        title: "Verbeterde foutafhandeling bij gebruiksnormen",
        body: "Bij de berekening van de gebruiksnormen tonen percelen met fouten nu specifieke foutmeldingen op hun respectievelijke kaarten, naast een algemene foutmelding voor de hele pagina. Succesvol berekende percelen worden nog steeds weergegeven.",
      },
      {
        title: "Gebruiksvriendelijker uploaden van shapefiles",
        body: "Het proces voor het uploaden van shapefiles is gebruiksvriendelijker gemaakt. Wanneer u een nieuw bestand selecteert, blijven de reeds gekozen bestanden behouden, wat het corrigeren van uw selectie vergemakkelijkt.",
      },
    ],
  },
  {
    version: "v0.22.0",
    date: "2025-08-15",
    title: "Atlas is vernieuwd, BRP 2025 en meer",
    description:
      "Deze update introduceert een vernieuwde Atlas app, toevoeging van gewasvariëteit, bijgewerkte percelen voor 2025, nieuwe gewassen en een opnieuw ontworpen startpagina voor een betere start.",
    items: [
      {
        title: "Vernieuwde Atlas",
        body: "De Atlas-app is opnieuw ontworpen voor een beter overzicht en meer gebruiksgemak. U kunt nu direct alle beschikbare percelen zien, zonder eerst een bedrijf te selecteren. Klik op een perceel om direct de details te zien, zoals de gewashistorie, wanneer een rustgewas op het perceel heeft gestaan, bodemtextuur en grondwater.",
      },
      {
        title: "Percelen op basis van het geselecteerde jaar",
        body: "De percelen die op de Atlas worden getoond, zijn nu van het jaar dat u in de kalender heeft geselecteerd. Zo ziet u altijd de juiste percelen voor het juiste jaar. De beschikbare percelen voor 2025 zijn nu ook toegevoegd.",
      },
      {
        title: "Percelen gekleurd op gewascategorie",
        body: "De percelen op de kaart zijn gekleurd aan de hand van de gewascategorie. Hiermee wordt de kaart duidelijker leesbaar en ziet u eenvoudig wat voor soort gewassen er staan. De opgeslagen en geselecteerde percelen hebben nu een gekleurde rand in plaats van een gekleurde vulling.",
      },
      {
        title: "Verbeterde wizard voor het aanmaken van een bedrijf",
        body: "De wizard voor het aanmaken van een bedrijf is verbeterd. U kunt nu direct vanuit de wizard terug naar de Atlas om meer percelen te selecteren. De percelen die u al heeft toegevoegd, worden nu ook op de kaart getoond.",
      },
      {
        title: "Variëteit toegevoegd",
        body: "U kunt nu de variëteit van een gewas selecteren (op dit moment alleen nog voor aardappelen en buitenbloemen). De variëteit wordt nu ook gebruikt bij het bepalen van de stikstofgebruiksnorm.",
      },
      {
        title: "Nieuwe gewassen toegevoegd",
        body: "De nieuwe BRP gewassen voor 2025 zijn toegevoegd.",
      },
      {
        title: "Nieuwe startpagina",
        body: "De startpagina na het inloggen is opnieuw ontworpen met kaarten die u direct toegang geven tot het aanmaken van een nieuw bedrijf of het verkennen van de Atlas. Nieuwe gebruikers krijgen een uitgebreidere introductie te zien.",
      },
      {
        title: "Snellere pagina's",
        body: "De pagina's voor de nutriëntenbalans, het nutriëntenadvies en de normen laden nu sneller, zodat u direct aan de slag kunt.",
      },
      {
        title: "Opgeloste fouten",
        body: "Er zijn verschillende bugs opgelost, waaronder een probleem waarbij de kaart voor het toevoegen van een nieuw perceel niet interactief was als er nog geen percelen waren.",
      },
    ],
  },
  {
    version: "v0.21.0",
    date: "2025-07-31",
    title: "Gebruiksnormen 2025, derogatie en import van Mijn Percelen",
    description:
      "Deze update implementeert de 2025 Nederlandse gebruiksnormen voor bemesting, maakt het mogelijk om derogatie te beheren, introduceert de RVO Mijn Percelen importer en verbetert het ontwerp van verschillende pagina's.",
    items: [
      {
        title: "Berekening van gebruiksnormen",
        body: "De nieuwe app 'Gebruiksnormen' berekent de wettelijke gebruiksruimte voor stikstof en fosfaat op uw percelen. Voor een zo nauwkeurig mogelijke berekening worden diverse gegevens gebruikt, zoals de hoofdteelt, grondsoort, de ligging van het perceel (bijvoorbeeld in een NV-gebied) en de meest recente bodemanalyse. Voor de transparantie toont de app niet alleen de berekende norm, maar ook de categorie en of er speciale restricties aanwezig zijn. Zo kunt u altijd herleiden hoe de berekening tot stand is gekomen.",
      },
      {
        title: "Derogatie per jaar",
        body: "Vanaf nu kunt u de derogatiestatus van uw bedrijf per jaar beheren. Dit zorgt voor een correcte berekening van de bijbehorende normen.",
      },
      {
        title: "'Mijn Percelen' uploaden",
        body: "In plaats van percelen handmatig op de kaart te selecteren, kunt u nu direct een shapefile van 'Mijn Percelen' (RVO) uploaden. De applicatie leest dit bestand in en importeert automatisch de percelen.",
      },
      {
        title: "Opsplitsing van het bouwplan",
        body: "De stappen 'Gewassen' en 'Bemesting' zijn nu opgesplitst in twee aparte pagina's voor meer duidelijkheid.",
      },
      {
        title: "Duidelijker gewassenoverzicht",
        body: "De lijst met teelten in het bouwplan is overzichtelijker gemaakt en toont nu ook het aantal percelen en de totale oppervlakte per gewas.",
      },
      {
        title: "Flexibele jaarkeuze",
        body: "U kunt nu een ander jaar dan het huidige selecteren bij het aanmaken van een bedrijf, wat handig is voor het invoeren van historische gegevens.",
      },
      {
        title: "Startjaar van derogatie",
        body: "Er is een optie toegevoegd om het startjaar van de derogatie van een bedrijf op te geven.",
      },
      {
        title: "Percelen verwijderen",
        body: "Het is nu mogelijk om een perceel direct vanuit de wizard te verwijderen.",
      },
      {
        title: "Vernieuwde teelt- en oogstpagina's",
        body: "De pagina's voor het beheren van teelten en oogsten hebben een complete make-over gekregen. U kunt nu sneller een teelt selecteren, details bekijken en direct nieuwe teelten of oogsten toevoegen via een dialoogvenster.",
      },
      {
        title: "Overzichtelijkere bemestingspagina",
        body: "Het ontwerp van de bemestingspagina's is verbeterd door het ontwerp duidelijker te maken.",
      },
      {
        title: "Visuele feedback bij berekeningen",
        body: "Pagina's die berekeningen uitvoeren (zoals nutriëntenadvies, normen en de balans) tonen nu direct een visuele placeholder. Zo weet u dat de pagina laadt en de resultaten binnenkort verschijnen.",
      },
    ],
  },
  {
    version: "v0.20.0",
    date: "2025-06-26",
    title: "Ammoniakemissie in de stikstofbalans, meststofsjablonen en bemestingsadvies",
    description:
      "Deze update breidt de stikstofbalans uit met ammoniakemissies, verbetert het meststoffenbeheer met sjablonen en toedieningsmethoden, en introduceert gedetailleerd bemestingsadvies.",
    items: [
      {
        title: "Ammoniakemissie in de stikstofbalans",
        body: "De stikstofbalans is uitgebreid met de berekening van ammoniakemissies. Dit geeft een completer beeld van de stikstofbalans op uw bedrijf en de impact op het milieu. Zowel de totale hoeveelheid uitgestoten ammoniak als de details op perceelsniveau worden nu weergegeven.",
      },
      {
        title: "Meststof als sjabloon",
        body: "Bij het aanmaken van een nieuwe meststof kunt u nu een bestaande meststof als sjabloon gebruiken. Dit vereenvoudigt het toevoegen van vergelijkbare producten.",
      },
      {
        title: "Verbeterd ontwerp van het meststofformulier",
        body: "Het ontwerp van de pagina voor het beheren van meststoffen is verbeterd, waardoor deze intuïtiever en duidelijker is in het gebruik.",
      },
      {
        title: "Toedieningsmethode toevoegen",
        body: "Het is nu mogelijk om de toedieningsmethode voor elke mestgift te specificeren in het daarvoor bestemde formulier.",
      },
      {
        title: "Weergave toedieningsmethode",
        body: "De gekozen toedieningsmethode voor elke mestgift wordt nu duidelijk weergegeven in de lijst met bemestingen.",
      },
      {
        title: "Advies voor NPK, OS, secundaire nutriënten en sporenelementen",
        body: "Voor elk perceel kunt u nu het bemestingsadvies zien voor de verschillende nutriënten op basis van de handboeken van CBAV en CBGV.",
      },
      {
        title: "Bijhouden van het bemestingsniveau",
        body: "Als u uw bemesting heeft ingevuld wordt voor elke nutriënt bijgehouden hoeveel er al bemest is. Zie eenvoudig welke nutriënt een tekort heeft en welke al voldoende is toegediend.",
      },
      {
        title: "Bodemanalyse uploaden",
        body: "Vanaf nu kunt u er voor kiezen om een pdf van een van de ondersteunde labs op te sturen en automatisch uit te lezen. Op deze manier kunt u eenvoudig de gegevens van uw bodemanalyse laten invoeren, zonder er veel moeite voor te doen.",
      },
      {
        title: "Zoekbalk op interactieve kaarten",
        body: "Er is een zoekbalk toegevoegd aan de interactieve kaarten, waarmee u adressen kunt opzoeken en hier direct naartoe kunt navigeren.",
      },
      {
        title: "Nieuwe datumprikkers",
        body: "De datumprikkers zijn vervangen door een nieuw, gecombineerde component met uitgebreide functies, zoals een dropdown-selectie voor jaar en maand en de mogelijkheid om direct tekst in te voeren.",
      },
      {
        title: "Standaard meststoffencatalogus",
        body: "Voor nieuwe bedrijven wordt nu standaard de BAAT-catalogus voor meststoffen gebruikt in plaats van de SRM-catalogus.",
      },
    ],
  },
  {
    version: "v0.19.0",
    date: "2025-05-27",
    title: "Meer bodemparameters, grafiek van de stikstofbalans en organisaties",
    description:
      "Deze update verbetert de bodemanalyse, introduceert stikstofbalansvisualisaties, en vereenvoudigt organisatie- en toegangsbeheer.",
    items: [
      {
        title: "Meer bodemparameters beschikbaar",
        body: "U kunt nu een nog breder scala aan bodemparameters vastleggen bij uw analyses, zoals N-mineraal, totale stikstof, organische koolstof, C/N-verhouding en bodemdichtheid. Daarnaast is er ondersteuning voor een uitgebreide lijst van specifieke elementen en eigenschappen, zoals de kationenuitwisselingscapaciteit (CEC), wat een dieper inzicht geeft in de bodemvruchtbaarheid en -samenstelling. Deze gegevens kunnen nu ook direct vanuit NMI-integraties worden overgenomen.",
      },
      {
        title: "Keuzelijst voor analysebron",
        body: "Bij het invoeren van een bodemanalyse kunt u nu de bron van de analyse selecteren uit een vaste keuzelijst, in plaats van vrije tekstinvoer. Dit zorgt voor meer consistentie in uw data.",
      },
      {
        title: "Type bodemanalyse kiezen",
        body: "Om het invoerformulier overzichtelijker te maken, kunt u nu een type bodemanalyse selecteren. Afhankelijk van het gekozen type wordt een relevante selectie van parameters getoond.",
      },
      {
        title: "Vergelijking met streefwaarde",
        body: "Zowel op bedrijfsniveau als op perceelsniveau wordt nu een vergelijking getoond tussen de berekende stikstofbalans en de geldende streefwaarde. Zo ziet u direct hoe u presteert.",
      },
      {
        title: "Grafische weergave van de stikstofbalans",
        body: "Op de stikstofbalanspagina's (voor bedrijf en percelen) vindt u nu een staafdiagram. Deze grafiek visualiseert de aanvoer, afvoer en emissie van stikstof, wat helpt om de balans beter te begrijpen.",
      },
      {
        title: "Organisaties aanmaken en beheren",
        body: "U kunt nu organisaties aanmaken. Dit is handig als u bijvoorbeeld als adviesbureau met meerdere adviseurs voor verschillende klanten werkt.",
      },
      {
        title: "Gebruikers uitnodigen",
        body: "Nodig eenvoudig andere gebruikers uit om lid te worden van uw organisatie.",
      },
      {
        title: "Toegang tot bedrijven delen",
        body: "Het is nu mogelijk om toegang tot een bedrijf te delen met andere gebruikers of zelfs met hele organisaties. U kunt hierbij aangeven welke rol (en dus welke rechten) de ander krijgt op uw bedrijf. Dit maakt het makkelijker om bijvoorbeeld uw adviseur toegang te geven tot uw bedrijfsgegevens.",
      },
      {
        title: "Nieuwe navigatie via de platformzijbalk",
        body: "Er is een nieuwe zijbalk toegevoegd voor platform-brede zaken. Hier vindt u nu bijvoorbeeld uw accountinstellingen, organisatiebeheer en de 'Wat is nieuw'-pagina.",
      },
      {
        title: "Kaart hernoemd naar Atlas",
        body: "De functionaliteit die voorheen 'Kaart' heette, is nu hernoemd naar 'Atlas' en verplaatst naar het 'Apps' gedeelte voor een logischere structuur.",
      },
      {
        title: "Context behouden bij navigeren",
        body: "Wanneer u in de paginakop een ander perceel of bedrijf selecteert, blijft u op de huidige pagina (bijvoorbeeld de instellingenpagina van dat perceel/bedrijf) in plaats van teruggestuurd te worden naar de startpagina.",
      },
      {
        title: "Betere afhandeling na inloggen",
        body: "Als u werd doorgestuurd naar de inlogpagina, wordt u na succesvol inloggen nu automatisch teruggebracht naar de pagina die u oorspronkelijk wilde bezoeken.",
      },
      {
        title: "Vernieuwde bedrijfsselectiepagina",
        body: "De pagina waar u een bedrijf selecteert, heeft een nieuw ontwerp gekregen met overzichtelijke kaarten per bedrijf, waarop direct enkele kerngegevens zichtbaar zijn.",
      },
      {
        title: "'Wat is er nieuw?' verplaatst",
        body: "Deze pagina is nu te vinden op '/about' sectie in de nieuwe platform zijbalk.",
      },
      {
        title: "Beperking bij oogsten",
        body: "Per oogstmoment kan nu slechts één oogstbaar product worden geregistreerd, wat de datastructuur vereenvoudigt.",
      },
    ],
  },
  {
    version: "v0.18.0",
    date: "2025-04-14",
    title: "Uitgebreid meststoffenbeheer, kalenderfilter en verbeterde bedrijfswizard",
    description:
      "Deze update introduceert nieuwe functies voor meststoffen- en percelenbeheer, een flexibele kalenderfilter, en verbeteringen in de 'Bedrijf Aanmaken' wizard.",
    items: [
      {
        title: "Uitgebreid meststoffenbeheer",
        body: "Het beheer van meststoffen is uitgebreid. U kunt nu via een speciale pagina een overzicht krijgen van alle beschikbare meststoffen voor uw bedrijf. Daarnaast kunt u de details van elke meststof bekijken en, belangrijker nog, de waarden van eigen meststoffen (die u zelf heeft toegevoegd of aangepast) direct bijwerken. Ook is er een nieuwe pagina om eenvoudig nieuwe, bedrijfsspecifieke meststoffen toe te voegen aan uw catalogus, wat zorgt voor een nauwkeurigere registratie van uw bemesting.",
      },
      {
        title: "Vereenvoudigd percelen toevoegen",
        body: "Het toevoegen van nieuwe percelen aan uw bedrijf is gestroomlijnd met een toegewijde nieuwe pagina, wat het proces sneller en intuïtiever maakt.",
      },
      {
        title: "Flexibel filteren met de kalender",
        body: "In de zijbalk vindt u nu een 'Kalender' optie. Deze functie stelt u in staat om uw data (zoals percelen, bemestingen, oogsten) te filteren op een specifiek jaar. Dit is ideaal voor jaarlijkse overzichten of analyses. U kunt er ook voor kiezen om alle data ongefilterd te tonen.",
      },
      {
        title: "Welkomstmail",
        body: "Om nieuwe gebruikers welkom te heten, wordt er nu automatisch een welkomstmail verstuurd na succesvolle registratie.",
      },
      {
        title: "Bodemanalyse direct toevoegen",
        body: "U hoeft de wizard niet meer te verlaten om een nieuwe bodemanalyse toe te voegen. Dit kan nu direct tijdens het configureren van een perceel binnen de wizard, wat tijd bespaart.",
      },
      {
        title: "Duidelijker bodemonderdeel",
        body: "De manier waarop bodemgegevens worden gepresenteerd en hoe u ermee interacteert op de perceelpagina binnen de wizard, is volledig herzien. Dit zorgt voor een beter overzicht en minder kans op fouten bij het invoeren van bodemdata.",
      },
      {
        title: "Overzichtelijkere percelenpagina",
        body: "De layout van de pagina voor het beheren van percelen binnen de wizard is verbeterd voor een betere workflow en duidelijkheid.",
      },
      {
        title: "Opgeloste weergaveproblemen bij oogsten",
        body: "Eerdere problemen met het correct weergeven van de oogstlijst en de bijbehorende detailpagina's binnen de wizard zijn verholpen.",
      },
      {
        title: "Voorkomen van navigatiefouten",
        body: "Om te voorkomen dat u per ongeluk de wizard verlaat, worden de links in de zijbalk nu tijdelijk uitgeschakeld (niet klikbaar) terwijl u bezig bent met het aanmaken van een bedrijf.",
      },
      {
        title: "Verbeterde paginatitels en beschrijvingen",
        body: "Om de navigatie te vergemakkelijken, hebben veel pagina's nu duidelijkere titels en informatieve beschrijvingen gekregen.",
      },
      {
        title: "Logo in de hele applicatie",
        body: "Het logo wordt nu consistent door de hele applicatie gebruikt, inclusief als website-icoon (favicon) en op plaatsen waar voorheen placeholders stonden.",
      },
      {
        title: "Profielfoto's van gekoppelde accounts",
        body: "Voor een persoonlijkere ervaring worden nu de profielfoto's van uw gekoppelde Microsoft en Google accounts correct weergegeven in uw gebruikersprofiel.",
      },
      {
        title: "Transparantie over ontwikkeling",
        body: "Een duidelijke melding op de inlogpagina informeert gebruikers dat de applicatie nog actief in ontwikkeling is en er regelmatig updates plaatsvinden.",
      },
      {
        title: "Soepelere sessieafhandeling",
        body: "Mocht uw sessie verlopen of ongeldig worden (bijvoorbeeld door een time-out), dan wordt u nu automatisch en zonder foutmeldingen teruggestuurd naar de inlogpagina.",
      },
      {
        title: "Consistente eenheden",
        body: "De eenheid voor gewasopbrengst wordt nu overal correct en consistent weergegeven als kilogram droge stof per hectare (kg DS / ha).",
      },
    ],
  },
  {
    version: "v0.17.0",
    date: "2025-03-14",
    title: "Lancering",
    description: "Vanaf nu kunt u bedrijven aanmaken, percelen toevoegen en bemestingen invullen.",
    items: [
      {
        title: "Account aanmaken",
      },
      {
        title: "Bedrijven aanmaken",
      },
      {
        title: "Percelen toevoegen",
      },
      {
        title: "Bemestingen invullen",
      },
    ],
  },
]
