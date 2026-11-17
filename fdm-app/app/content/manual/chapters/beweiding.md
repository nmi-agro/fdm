---
title: Beweiding
description: Leg vast waar en hoe lang je koeien weiden, op het hele perceel of in een zone, plan je weideseizoen in stroken en volg weidedagen, Weidemelk en veebezetting.
section: Gegevens vastleggen
order: 9
inApp:
  - Melkvee
  - Beweiding
routes:
  - farm.$b_id_farm.$calendar.grazing*
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

Op **Beweiding** leg je vast welke koppel wanneer op welk perceel heeft geweid, en hoeveel uur per dag. {{appName}} rekent daaruit je weidedagen, de voortgang naar Weidemelk (120 dagen × 6 uur) en de veebezetting op het beweidingsplatform. Je hebt hiervoor minstens één koppel nodig (zie [Veestapel](/manual/veestapel)) en percelen met grasland in je [bouwplan](/manual/bouwplan).

## De beweidingskalender {#kalender}

De kalender toont per graslandperceel de weken van het jaar. Een cel laat zien of er die week is beweid, gemaaid of dat het perceel rust; geplande beweiding is apart gemarkeerd. Achter elk perceel staat hoeveel dagen het al rust: vanaf het laatste gebruik in het gekozen jaar tot vandaag, of tot 31 december als je een eerder jaar bekijkt. Een gebruik in een ander jaar telt niet mee, en geplande beweiding ook niet. Onder de kalender zie je de weidedagen, de gemiddelde weide-uren per dag, de voortgang naar Weidemelk en het beweidingsplatform.

![De beweidingskalender met weken per perceel](screenshot:beweiding-kalender)

Kies bovenaan de koppel waarvoor je wilt registreren. Daarna:

- klik op een lege cel om een beweiding van één dag vast te leggen: vandaag als die in de week valt, anders de eerste dag van de week. Klik op een cel met een beweiding om die te bekijken en aan te passen;
- sleep over meerdere cellen van één perceel om een langere periode in één keer vast te leggen.

Met **Week** en **Dag** boven de kalender wissel je tussen de weken van het jaar en de dagen van één maand. In de dagweergave blader je met de pijlen naar een andere maand. De huidige week of dag is gemarkeerd.

### Maaien en bemesten in de kalender {#maaien-bemesten}

De kalender toont ook de maaisneden en bemestingen van je graslandpercelen, met een aar voor maaien en een schep voor bemesten. Ga met de muis over het symbool voor de datum en de meststof.

- Met **Maaisnede toevoegen** of **Bemesting toevoegen** boven de kalender kies je een perceel. Daarna vul je hetzelfde formulier in als op de [Tijdlijn](/manual/tijdlijn). De datum staat op vandaag, of op dezelfde dag in het gekozen jaar.
- Klik op het symbool in een week om die maaisnede of bemesting aan te passen of te verwijderen.

Een bemesting telt niet mee als gebruik voor de dagen rust; een maaisnede wel.

## Een beweiding vastleggen {#vastleggen}

In het venster dat opent kies je de koppel en de periode, en het aantal uren per dag: **Dag & nacht (24u)**, **Beperkt (8u)** of **Aangepast**. Ligt de startdatum in de toekomst, dan legt {{appName}} de beweiding vast als plan.

Bij _Oppervlak_ kies je welk deel van het perceel de koppel heeft beweid:

- het hele perceel, de standaard;
- **Zone op de kaart**: je tekent of kiest het beweide deel op de kaart (zie hieronder);
- **Deel van perceel, zonder kaart**: je geeft alleen aan welk percentage van het perceel is beweid, zonder plek.

Klik op **Vastleggen**. Een bestaande beweiding pas je aan met **Opslaan** of verwijder je met **Verwijderen**.

### Een zone tekenen of hergebruiken {#zones}

Kies je **Zone op de kaart**, dan zie je het perceel op de kaart.

1. Klik op **Tekenen** en zet met klikken de hoeken van de zone. Dubbelklik om af te ronden.
2. Met **Aanpassen** versleep je hoeken of voeg je hoeken toe; met **Wissen** begin je opnieuw.
3. Onder de kaart staan de **Eerder gebruikte zones** van dit perceel. Klik op een zone om hem opnieuw te gebruiken, bijvoorbeeld een vast blok dat je elke ronde weer beweidt.

Een hoek die je dicht bij de perceelsgrens of bij een eerdere strook zet, springt vanzelf op die grens; dicht bij een hoek van het perceel springt hij op die hoek. Zo sluit een zone precies aan zonder dat je heel nauwkeurig hoeft te klikken. Teken je toch over de perceelsgrens heen, dan knipt {{appName}} de zone af op de grens zodra je klaar bent met tekenen of aanpassen.

Boven de kaart zie je hoeveel hectare van de zone binnen het perceel ligt.

![Een zone tekenen op het perceel, met eerder gebruikte zones eronder](screenshot:beweiding-zone-tekenen)

### Een strook laten berekenen {#strook}

Bij stripgrazen of rantsoenbeweiding krijgen je koeien steeds een nieuwe strook vers gras. Met **Strook berekenen** rekent {{appName}} uit hoe groot die strook moet zijn en snijdt hem uit het perceel:

1. Kies de **Richting** waarin je met de draad opschuift over het perceel.
2. Controleer het aantal dieren, de grasopname per dier en het grasaanbod. {{appName}} vult ze in met richtwaarden; pas ze aan voor je eigen bedrijf.
3. Klik op **Strook maken**.

De nieuwe strook sluit aan op de stroken die je de afgelopen 28 dagen op dit perceel hebt beweid; die zie je grijs op de kaart. Is het perceel rond, dan begin je weer vooraan. Hoe de strookgrootte wordt berekend, lees je in de [achtergrond bij beweiding](/manual/background/beweiding#strook).

![De strook berekenen: richting, dieren, grasopname en grasaanbod, met de berekende strook op de kaart](screenshot:beweiding-strook)

## Koeien naar buiten en naar binnen {#naar-buiten}

Met **Koeien naar buiten** leg je snel vast waar een koppel weidt. Kies de koppel, het perceel en het aantal uren per dag. Bij _Wanneer_ staat vandaag; bij _Tot en met_ dezelfde dag. Kies je bij _Tot en met_ een latere datum, dan plan je de beweiding alvast vooruit. Klik op **Koeien naar buiten vastleggen**.

Loopt een koppel nog buiten zonder einddatum, bijvoorbeeld uit een eerdere registratie, dan toont hetzelfde venster **Koeien naar binnen**. Vul de einddatum in en klik op **Koeien naar binnen vastleggen**. Zolang zo'n beweiding loopt, staat ze in de kalender tot en met vandaag. Open je haar daar om bijvoorbeeld de uren aan te passen, laat dan de einddatum leeg; dan blijft de beweiding lopen.

## Beweiding op de kaart {#vandaag}

In de [Atlas](/manual/atlas) staat de kaartlaag _Beweiding_. Je opent hem met **Beweiding op de kaart** op de beweidingskalender, met **Beweiding vandaag** onder _Acties_ op de bedrijfspagina, of via de lijst met kaartlagen in de Atlas.

De kaart kleurt je percelen naar hun gebruik op één dag: beweid, gemaaid, in rust of nog niet gebruikt in het gekozen jaar. Percelen zonder grasland zijn grijs. Zones die die dag worden beweid, staan donkergroen op het perceel. De legenda telt hoeveel percelen elke status hebben.

- _Dag kiezen_: met de pijlen ga je een dag terug of vooruit, en met de datumkiezer spring je naar een andere dag. De kaart opent op de datum van vandaag in het gekozen jaar en blijft binnen dat jaar. Met **Vandaag** ga je terug naar die dag. **Beweiding vandaag** opent altijd het huidige jaar.
- _Perceel bekijken_: ga met de muis over een perceel voor de koppel en de uren per dag, de opbrengst van een maaisnede of het aantal dagen rust. De dagen rust tellen alleen vanaf een gebruik in het gekozen jaar. Klik op een graslandperceel om de beweidingspagina van dat perceel te openen; op een telefoon tik je op het perceel en daarna op **Bekijk beweiding**.
- _Koeien naar buiten of binnen_: met **Koeien naar buiten / binnen** in het paneel links boven leg je dat direct vast, zoals hierboven beschreven.

Heeft je bedrijf nog geen koppel, dan staat de kaartlaag grijs in de lijst. Voeg eerst een koppel toe bij [Veestapel](/manual/veestapel).

![De kaartlaag Beweiding: de status per perceel, de beweide zone en de legenda](screenshot:beweiding-vandaag)

## Je weideseizoen plannen {#plannen}

Met de **Graslandgebruiksysteem planner** maak je in één keer een plan voor het hele seizoen:

1. Kies een systeem, zoals omweiden, standweiden, Nieuw Nederlands Weiden, stripgrazen of rantsoenbeweiding. {{appName}} vult per systeem het aantal dagen per perceel en de uren per dag in. Bij zomerstalvoedering of summerfeeding is er geen weidegang; dan maakt de planner geen plan.
2. Kies wat je meeneemt: de koppel, de periode, de percelen die je wilt beweiden, de uren per dag en hoe vaak je van perceel wisselt.
3. Controleer het plan en klik op de knop om het vast te leggen.

Wat er wordt vastgelegd, hangt af van het jaar. In het huidige jaar worden perioden die na vandaag beginnen geplande beweiding, en eerdere perioden beweiding die al heeft plaatsgevonden. In een eerder jaar leg je zo een afgelopen seizoen achteraf vast, en in een later jaar is alles gepland.

Bij stripgrazen en rantsoenbeweiding kies je ook hoe groot het beweide deel per keer is:

- **Stroken op de kaart**: de planner snijdt voor elke weidebeurt een nieuwe strook uit het perceel, met de grootte uit de berekening hierboven. Elke strook sluit aan op de vorige.
- **Percentage, zonder kaart**: elke weidebeurt beslaat een vast percentage van het perceel, zonder plek.

Percelen zonder perceelsgrens krijgen altijd het percentage. Perioden die overlappen met beweiding die je al hebt vastgelegd, slaat de planner over; je ziet ze in een waarschuwing.

![De planner: systeem, percelen en de geplande perioden](screenshot:beweidingsplan)

## Beweiding per perceel {#perceel}

Op de pagina van een perceel staat het tabblad **Beweiding**. Daar zie je alle beweidingen en maaisneden van dat perceel op een rij, met per gebruik de koppel, de uren per dag, het beweide deel en de rust ervoor. Een rust die korter is dan de richtlijn, is gemarkeerd. Zijn er zones beweid, dan zie je ze op een kaart. Met **Beweiding toevoegen** leg je een beweiding vast voor dit perceel.

De rust telt per deel van het perceel: bij stripgrazen krijgt elke strook zijn eigen rustperiode.

## Inzichten in je weidegang {#inzichten}

Met **Weidegang** op de beweidingskalender, of de kaart **Weidegang** op het bedrijfsdashboard, open je de inzichten van het jaar:

- weidedagen, gemiddelde weide-uren per dag, het beweidingsplatform en de veebezetting op dat platform;
- de voortgang naar Weidemelk: 120 dagen met minstens 6 uur weidegang van de melkkoeien;
- de weidedagen per maand, gerealiseerd en gepland;
- **Aandachtspunten**, zoals percelen die te kort hebben gerust of beweidingen zonder uren per dag.

![De inzichten in de weidegang van het jaar](screenshot:beweiding-inzichten)

Hoe deze getallen worden berekend, lees je in de [achtergrond bij beweiding](/manual/background/beweiding).

## Beweiding en de gebruiksnorm {#gebruiksnorm}

Leg je een beweiding vast, dan zet {{appName}} de beweiding voor dat jaar aan. In de stikstofgebruiksnorm telt je grasland dan als beweid grasland in plaats van alleen maaien. Wil je dat aanpassen, dan doe je dat bij de instellingen van je bedrijf onder **Beweiding**. Hoe dat de gebruiksruimte beïnvloedt, lees je bij [Gebruiksruimte](/manual/gebruiksruimte).

> De gebruiksnormen in {{appName}} zijn indicatief en alleen bedoeld ter informatie. Raadpleeg voor de definitieve normen en je verantwoording altijd de officiële publicaties van RVO en je adviseur.
