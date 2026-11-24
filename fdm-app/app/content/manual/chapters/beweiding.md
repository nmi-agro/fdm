---
title: Beweiding
description: Leg vast waar en hoe lang je koeien weiden, op het hele perceel of in een zone, plan je weideseizoen in stroken en volg weidedagen, Weidemelk en veebezetting.
section: Gegevens vastleggen
order: 9
inApp:
  - Melkvee
  - Beweidingskalender
routes:
  - farm.$b_id_farm.$calendar.livestock.grazing*
  - farm.$b_id_farm.$calendar.field.$b_id.grazing*
watch:
  - fdm-app/app/components/blocks/grazing/**
  - fdm-app/app/lib/grazing-*.ts
keywords:
  - beweiding
  - weidegang
  - weidedagen
  - Weidemelk
  - stripgrazen
  - omweiden
  - beweidingsplan
  - veebezetting
related:
  - veestapel
  - background/beweiding
  - gebruiksruimte
---

Op de **Beweidingskalender**, onder **Melkvee** in het menu of via de kaart onder **Overzichten** op het bedrijfsdashboard, leg je vast welke koppel wanneer op welk perceel heeft geweid, en hoeveel uur per dag. {{appName}} rekent daaruit je weidedagen, de voortgang naar Weidemelk (120 dagen × 6 uur) en de veebezetting op het beweidingsplatform. De beweiding van deze dagen zie je ook op het [Melkvee-overzicht](/manual/veestapel#overzicht). Je hebt hiervoor minstens één koppel nodig (zie [Melkvee](/manual/veestapel)) en percelen met grasland in je [bouwplan](/manual/bouwplan).

## De beweidingskalender {#kalender}

De kalender toont per graslandperceel elke dag van het weideseizoen, van 1 maart tot en met 31 oktober. De dagen staan smal naast elkaar; op een kleiner scherm schuif je de kalender opzij. Percelen die in het gekozen jaar zijn beweid staan bovenaan, daarna de grootste percelen eerst. Een groene dag is beweid, een donkergroene gemaaid, en een dag die boven groen en onder donkergroen is, is beweid én gemaaid; geplande beweiding is groen gestreept. Dezelfde kleuren zie je op het Melkvee-overzicht, op de kaart en bij het perceel. Een bemesting is een stip in de kleur van de meststof: bruin voor dierlijke mest, blauw voor kunstmest. Ga met de muis over een dag, of loop er met het toetsenbord langs, en een venstertje toont de datum, het perceel en de koppel, de maaisnede of de bemesting van die dag. Vandaag is gemarkeerd. Achter elk perceel staat hoeveel dagen het al rust: vanaf het laatste gebruik in het gekozen jaar tot vandaag, of tot 31 december als je een eerder jaar bekijkt. Een gebruik in een ander jaar telt niet mee, en geplande beweiding ook niet. Loopt het laatste gebruik tot die dag door, dan staat er _in gebruik_. Onder de kalender zie je de weidedagen, de gemiddelde weide-uren per dag, de voortgang naar Weidemelk en het beweidingsplatform. Is een perceel eerder opnieuw gebruikt dan de richtlijn voor rust, dan staat daar ook een korte melding met een link naar de uitleg op [Weidegang](#inzichten).

Een beweiding buiten 1 maart tot en met 31 oktober telt gewoon mee, maar staat niet in de kalender. Je vindt haar op het tabblad Beweiding van het [perceel](#perceel), en het venster van de beweiding waarschuwt als een datum buiten de kalender valt.

![De beweidingskalender met de dagen van het seizoen per perceel](screenshot:beweiding-kalender)

Kies bovenaan bij _Vastleggen voor_ de koppel waarvoor je wilt registreren; de kalender toont altijd alle koppels. Daarna:

- klik op een lege dag om een beweiding op die dag vast te leggen. Klik op een dag met een beweiding, maaisnede of bemesting om die te bekijken, aan te passen of te verwijderen. Staat er op die dag meer, bijvoorbeeld twee koppels of een beweiding en een maaisnede, dan kies je eerst wat je opent;
- sleep over meerdere dagen van één perceel om een langere periode in één keer vast te leggen. Laat je de muisknop buiten de kalender los, dan wordt er niets vastgelegd;
- klik met de rechtermuisknop op een dag om te openen wat er op die dag staat, of om daar een beweiding, maaisnede of bemesting toe te voegen;
- met het toetsenbord: ga met Tab naar de kalender, of open **Uitleg** naast de legenda en klik op **ga naar vandaag in de kalender** (buiten het seizoen **ga naar de kalender**). Met de pijltjestoetsen loop je door de dagen en percelen, Enter opent de dag, en met Shift en pijl links of rechts kies je meerdere dagen voor één beweiding;
- of gebruik **Beweiding toevoegen** boven de kalender en kies een perceel. De beweiding staat dan op vandaag, of op dezelfde dag in het gekozen jaar.

### Maaien en bemesten in de kalender {#maaien-bemesten}

Met **Meer toevoegen** boven de kalender en dan **Maaisnede toevoegen** of **Bemesting toevoegen**, of met de rechtermuisknop op een dag, voeg je een maaisnede of bemesting toe. Je vult hetzelfde formulier in als op de [Tijdlijn](/manual/tijdlijn), in een venster. Via de knoppen boven de kalender staat de datum op vandaag, of op dezelfde dag in het gekozen jaar. Een maaisnede hoort bij het grasgewas van die datum, ook als er later in het jaar een ander gewas op het perceel staat; de oogst van een ander gewas leg je vast op de Tijdlijn.

Een bemesting telt niet mee als gebruik voor de dagen rust; een maaisnede wel.

## Een beweiding vastleggen {#vastleggen}

Een beweiding leg je overal in {{appName}} met hetzelfde venster vast: vanuit de kalender, met **Beweiding toevoegen** op de kalender of op de kaart, en op de beweidingspagina van een perceel.

In het venster kies je eerst of de koppel **1 dag** of **Meerdere dagen** weidt. Bij één dag vul je alleen de datum in: die is de eerste en de laatste dag. Bij meerdere dagen vul je de eerste en de laatste dag in. Elke beweiding heeft een laatste dag; lopen de koeien langer buiten, pas de beweiding dan aan of leg een nieuwe vast. Daarna kies je de koppel en het aantal uren per dag: **Dag & nacht (24u)**, **Beperkt (8u)** (de standaard) of **Aangepast**. Ligt de startdatum in de toekomst, dan legt {{appName}} de beweiding vast als plan. Onder in het venster zie je hoeveel weidedagen en weide-uren je vastlegt, en dat de eerste beweiding van een jaar de instelling _Beweiding_ voor de stikstofgebruiksnorm aanzet (zie [hieronder](#gebruiksnorm)).

Heeft een bestaande beweiding geen uren per dag, dan blijven die open als je alleen iets anders aanpast. Hetzelfde geldt voor een deel van het perceel zonder kaart: dat blijft precies zo groot tot je het percentage verandert.

Een koppel kan op één dag meer dan één beweiding hebben, ook op hetzelfde perceel: bijvoorbeeld 's ochtends op de ene zone en 's middags op een andere, of twee keer op dezelfde zone. De uren van die beweidingen tellen op, en samen mogen ze niet boven 24 uur per dag komen. Komt de koppel daarboven, dan krijg je een melding; pas dan de uren of de datum aan.

Een beweiding is altijd op een perceel en moet passen binnen de periode van de koppel: niet vóór de start van de koppel, en bij een beëindigde koppel uiterlijk de dag voor het einde. Voeg je op de beweidingspagina van een perceel in een eerder jaar een beweiding toe, dan staat de datum al in dat jaar.

Bij _Oppervlak_ kies je welk deel van het perceel de koppel heeft beweid:

- het hele perceel, de standaard;
- **Zone op de kaart**: je tekent of kiest het beweide deel op de kaart (zie hieronder);
- **Deel van perceel, zonder kaart**: je geeft alleen aan welk percentage van het perceel is beweid, zonder plek.

Klik op **Vastleggen**. Bij een zone kan dat pas als je een zone hebt getekend of gekozen. Een bestaande beweiding pas je aan met **Opslaan** of verwijder je met **Verwijderen**; dat bevestig je eerst.

### Een zone tekenen of hergebruiken {#zones}

Kies je **Zone op de kaart**, dan zie je het perceel op de kaart, met de witte stippellijn als perceelsgrens. De zone is licht met een witte rand, zodat hij ook op groen grasland goed zichtbaar is; stroken van de afgelopen 28 dagen zijn donker met een witte streepjeslijn.

1. Klik op **Tekenen** en zet met klikken de hoeken van de zone. Rond af door op het eerste punt te klikken, te dubbelklikken of op Enter te drukken. Een klik dicht bij het eerste punt rondt de zone ook af; zoom daarom in als je een smalle strook tekent, of voeg de ontbrekende hoek daarna toe met **Aanpassen**. Met Esc stop je de tekening zonder het venster te sluiten. Teken je opnieuw terwijl er al een zone is, dan vervangt de nieuwe zone de oude.
2. Met **Aanpassen** is de zone direct gekozen: versleep een hoek, klik op een middenpunt voor een extra hoek of klik met de rechtermuisknop op een hoek om hem te verwijderen. Met **Wissen** begin je opnieuw.
3. Met **Ongedaan maken** (of Ctrl+Z) zet je de laatste wijziging terug: tijdens het tekenen de laatste hoek, daarna de vorige zone, ook na **Wissen** of een berekende strook.
4. Onder de kaart staan de **Eerder gebruikte zones** van dit perceel, met datum, koppel en hoe vaak ze zijn gebruikt. Ga met de muis over een zone om hem op de kaart te zien, en klik om hem opnieuw te gebruiken, bijvoorbeeld een vast blok dat je elke ronde weer beweidt.

Een hoek die je dicht bij de perceelsgrens, bij een eerdere strook of bij je eigen zone zet, springt vanzelf op die grens; dicht bij een hoek springt hij op die hoek. Een witte stip laat zien waar de hoek terechtkomt. Wil je vrij tekenen, houd dan Alt ingedrukt. Teken je toch over de perceelsgrens heen, dan knipt {{appName}} de zone af op de grens zodra je klaar bent met tekenen of aanpassen, en meldt dat. Een zone die helemaal buiten het perceel ligt, wordt niet overgenomen.

Boven de kaart zie je hoeveel hectare van de zone binnen het perceel ligt. Met **Perceel in beeld** zet je het hele perceel weer in beeld.

![Een zone tekenen op het perceel, met eerder gebruikte zones eronder](screenshot:beweiding-zone-tekenen)

### Een strook laten berekenen {#strook}

Bij stripgrazen of rantsoenbeweiding krijgen je koeien steeds een nieuwe strook vers gras. Met **Strook berekenen** rekent {{appName}} uit hoe groot die strook moet zijn en snijdt hem uit het perceel:

1. Kies de **Richting** waarin je met de draad opschuift over het perceel.
2. Controleer het aantal dieren, de grasopname per dier en het grasaanbod. {{appName}} vult ze in met richtwaarden; pas ze aan voor je eigen bedrijf.
3. Klik op **Strook maken**.

De nieuwe strook sluit aan op de stroken die in de 28 dagen voor deze beweiding op dit perceel zijn beweid; die zie je donker met een witte streepjeslijn op de kaart. Is het perceel rond, dan begin je weer vooraan. Is in die 28 dagen het hele perceel beweid, dan is er geen vrije strook. Is er een deel beweid met alleen een percentage, zonder plek op de kaart, dan is niet bekend welk deel vrij is; teken de zone dan zelf. Kies eerst een begindatum: de strook hangt af van wat er in de 28 dagen daarvoor is beweid. Konden die beweidingen niet worden geladen, dan kun je geen strook laten berekenen; probeer het dan nog eens met **Opnieuw laden**. Verander je de datum, dan wacht de strookberekening even tot de zones voor die datum zijn geladen. Het aantal dieren en de grasopname volgen de koppel en de uren die je in het venster kiest, tot je ze zelf aanpast. Hoe de strookgrootte wordt berekend, lees je in de [achtergrond bij beweiding](/manual/background/beweiding#strook).

![De strook berekenen: richting, dieren, grasopname en grasaanbod, met de berekende strook op de kaart](screenshot:beweiding-strook)

## Beweiding op de kaart {#vandaag}

In de [Atlas](/manual/atlas) staat de kaartlaag _Beweiding_. Je opent hem met **Op de kaart** boven de beweidingskalender, met **Beweiding vandaag** onder _Acties_ op de bedrijfspagina, of via de lijst met kaartlagen in de Atlas.

De kaart kleurt je percelen naar hun gebruik op één dag, in de kleuren van de kalender: beweid, gemaaid, in rust of nog niet gebruikt in het gekozen jaar. Een beweid perceel heeft ook een donkere rand. Percelen zonder grasland zijn grijs. Zones die die dag worden beweid, staan licht met een witte rand op het perceel, net als bij het tekenen van een zone. De legenda telt hoeveel percelen elke status hebben.

- _Dag kiezen_: met de pijlen ga je een dag terug of vooruit, en met de datumkiezer spring je naar een andere dag. De kaart opent op de datum van vandaag in het gekozen jaar en blijft binnen dat jaar. Met **Vandaag** ga je terug naar die dag. **Beweiding vandaag** opent altijd het huidige jaar.
- _Perceel bekijken_: ga met de muis over een perceel voor de koppel en de uren per dag, de opbrengst van een maaisnede of het aantal dagen rust. De dagen rust tellen alleen vanaf een gebruik in het gekozen jaar. Klik op een graslandperceel om de beweidingspagina van dat perceel te openen; op een telefoon tik je op het perceel en daarna op **Bekijk beweiding**.
- _Beweiding toevoegen_: met **Beweiding toevoegen** in het paneel links boven kies je een perceel en leg je een beweiding vast op de getoonde dag.

Heeft je bedrijf nog geen koppel, dan staat de kaartlaag grijs in de lijst. Voeg eerst een koppel toe bij [Melkvee](/manual/veestapel).

![De kaartlaag Beweiding: de status per perceel, de beweide zone en de legenda](screenshot:beweiding-vandaag)

## Je weideseizoen plannen {#plannen}

Met de **Beweidingsplanner**, onder **Melkvee** in het menu of in de werkbalk boven de beweidingskalender, maak je in één keer een plan voor het hele seizoen volgens een graslandgebruikssysteem:

1. Kies een systeem, zoals omweiden, standweiden, Nieuw Nederlands Weiden, stripgrazen of rantsoenbeweiding. {{appName}} vult per systeem het aantal dagen per perceel en de uren per dag in. Bij zomerstalvoedering of summerfeeding is er geen weidegang; dan maakt de planner geen plan.
2. Kies wat je meeneemt: de koppel, de periode, de percelen die je wilt beweiden, de uren per dag en hoe vaak je van perceel wisselt.
3. Controleer het plan en klik op de knop om het vast te leggen.

Wat er wordt vastgelegd, hangt af van het jaar. In het huidige jaar worden perioden die na vandaag beginnen geplande beweiding, en eerdere perioden beweiding die al heeft plaatsgevonden. In een eerder jaar leg je zo een afgelopen seizoen achteraf vast, en in een later jaar is alles gepland. De periode loopt standaard van 1 mei tot 15 oktober, of van vandaag als het seizoen al is begonnen. Is het seizoen van dit jaar voorbij, dan wijst de planner je naar volgend jaar.

Bij stripgrazen en rantsoenbeweiding kies je ook hoe groot het beweide deel per keer is:

- **Stroken op de kaart**: de planner snijdt voor elke weidebeurt een nieuwe strook uit het perceel, met de grootte uit de berekening hierboven. Elke strook sluit aan op de vorige.
- **Percentage, zonder kaart**: elke weidebeurt beslaat een vast percentage van het perceel, zonder plek.

Bij Nieuw Nederlands Weiden deelt de planner de gekozen percelen op in percelen van gelijke grootte. Bij _Perceelsgrootte (ha)_ staat 2,5 ha per 120 koeien, omgerekend naar je koppel; pas het aan voor je bedrijf. De koppel krijgt elke dag het volgende perceel. Weidt de koppel dag en nacht (meer dan 12 uur), dan krijgt hij 's ochtends en 's avonds een nieuw perceel, elk als eigen beweiding met de helft van de uren, ook als ze op hetzelfde perceel liggen. Samen tellen ze als één weidedag met alle uren. Daarvoor zijn minstens twee percelen nodig; levert de opdeling er maar één op, dan slaat de planner de periode over en zegt waarom.

Bij stroken en bij Nieuw Nederlands Weiden zie je de stroken of percelen op een kaart boven het plan. Ga met de muis over een regel van het plan om de strook op de kaart te zien, of over een strook op de kaart om de regels ervan te zien.

Percelen zonder perceelsgrens krijgen altijd het percentage. Het plan loopt tot en met de laatste dag van de periode en blijft binnen het gekozen jaar; een perceel krijgt hoogstens 60 dagen achter elkaar. Een periode die niet kan worden vastgelegd, slaat de planner over: de koppel zou dan boven 24 uur per dag komen, de koppel liep toen nog niet of niet meer, of het perceel was toen geen grasland. Je ziet die perioden met de reden in een waarschuwing.

![De planner: systeem, percelen en de geplande perioden](screenshot:beweidingsplan)

## Beweiding per perceel {#perceel}

Op de pagina van een perceel staat het tabblad **Beweiding**. Bovenaan staan de weidedagen, de weide-uren, het aantal beweidingsperioden en de maaisneden van het jaar. Daaronder zie je alle beweidingen en maaisneden van dat perceel op een rij, met per gebruik de koppel, de uren per dag, het beweide deel en de rust ervoor. Een geplande beweiding is gemarkeerd met _Gepland_, en een rust die korter is dan de richtlijn ook. Zijn er zones beweid, dan staan ze op een kaart naast de lijst; geplande beweiding staat niet op de kaart. Met **Beweiding toevoegen** leg je een beweiding vast voor dit perceel. Klik op de koppel van een beweiding om die aan te passen of te verwijderen; zo bereik je ook een beweiding buiten het seizoen van de kalender.

De rust telt per deel van het perceel: bij stripgrazen krijgt elke strook zijn eigen rustperiode.

## Inzichten in je weidegang {#inzichten}

Met **Weidegang** in het menu onder Melkvee of op het Melkvee-overzicht open je de inzichten van het jaar:

- weidedagen, de gemiddelde weide-uren per weidedag met vastgelegde uren, het beweidingsplatform en de veebezetting op dat platform;
- de voortgang naar Weidemelk: 120 dagen met minstens 6 uur weidegang van de melkkoeien;
- de weidedagen per maand, gerealiseerd en gepland;
- **Aandachtspunten**, als die er zijn: percelen die te kort hebben gerust, met de uitleg van de richtlijn voor rust, of beweidingen zonder uren per dag.

De veebezetting staat er twee keer: op het beweidingsplatform en op al het grasland. Het Melkvee-overzicht en de kalender tonen de veebezetting op het platform.

![De inzichten in de weidegang van het jaar](screenshot:beweiding-inzichten)

Hoe deze getallen worden berekend, lees je in de [achtergrond bij beweiding](/manual/background/beweiding).

## Beweiding en de gebruiksnorm {#gebruiksnorm}

Leg je de eerste beweiding van een jaar vast, dan zet {{appName}} de beweiding voor dat jaar aan. Dat gebeurt ook als je een beweiding verplaatst naar een jaar waarin nog geen beweiding stond. Latere beweidingen veranderen de instelling niet. In de stikstofgebruiksnorm telt je grasland dan als beweid grasland in plaats van alleen maaien. Wil je dat aanpassen, dan doe je dat bij de instellingen van je bedrijf onder **Beweiding**. Hoe dat de gebruiksruimte beïnvloedt, lees je bij [Gebruiksruimte](/manual/gebruiksruimte).

> De gebruiksnormen in {{appName}} zijn indicatief en alleen bedoeld ter informatie. Raadpleeg voor de definitieve normen en je verantwoording altijd de officiële publicaties van RVO en je adviseur.
