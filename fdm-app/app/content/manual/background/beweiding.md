---
title: Beweiding
description: Hoe weidedagen, Weidemelk, het beweidingsplatform, de veebezetting, de rustperiode en de strookgrootte worden berekend, met de bronnen en aannames.
section: Vee en beweiding
order: 1
inApp:
  - Melkvee
  - Weidegang
lastReviewed: 2026-11-17
routes: []
watch:
  - fdm-calculator/src/grazing/**
  - fdm-app/app/lib/grazing-strip.ts
keywords:
  - weidedagen berekenen
  - Weidemelk 120 dagen 6 uur
  - beweidingsplatform
  - veebezetting GVE per hectare
  - rustperiode grasland
  - strookgrootte stripgrazen
related:
  - beweiding
  - veestapel
  - background/gebruiksruimte
---

Deze pagina legt uit hoe {{appName}} de getallen bij beweiding berekent: de weidedagen en weide-uren, de voortgang naar Weidemelk, het beweidingsplatform en de veebezetting, de rustperiode en de grootte van een strook. Alle getallen komen uit de beweiding die je zelf vastlegt; {{appName}} meet geen grasgroei. Waar een waarde een aanname is en niet uit een bron komt, staat dat erbij.

## Weidedagen en weide-uren {#weidedagen}

Een weidedag is een kalenderdag waarop een koppel buiten heeft gelopen. Loopt een koppel op één dag op twee percelen, dan telt die dag één keer. Voor de weide-uren tellen de uren van alle beweidingen van een koppel op één dag op: 8 uur op het ene perceel of de ene zone en 7 uur op een andere is 15 uur voor die koppel, tot hoogstens 24 uur. Een koppel kan op een dag dus meer dan één beweiding hebben, ook op hetzelfde perceel, zolang ze samen niet boven 24 uur komen. Lopen er op een dag meerdere koppels buiten, dan tellen voor het bedrijf de uren van de koppel die het langst buiten liep; het gemiddelde is per weidedag. Beweiding zonder uren per dag telt mee als weidedag, maar niet voor de uren; {{appName}} meldt welke beweidingen uren missen.

Elke beweiding heeft een eerste en een laatste dag. Dagen na vandaag zijn gepland: die tellen niet mee in de gerealiseerde weidedagen, maar staan er apart bij. Vandaag is de kalenderdag in Nederland. Een beweiding over de jaargrens, bijvoorbeeld van 28 december tot 3 januari, telt in elk jaar alleen de dagen van dat jaar.

## Weidemelk {#weidemelk}

Voor Weidemelk moeten de melkkoeien minstens 120 dagen per jaar minstens 6 uur per dag buiten lopen. {{appName}} telt daarvoor de dagen waarop een koppel in de diercategorie melk- en kalfkoeien (RVO-categorie 100) minstens 6 uur buiten liep, met de uren van al zijn beweidingen op die dag samen. Elke dag van het jaar telt mee, ook buiten het weideseizoen van de kalender; "Niet gehaald" verschijnt pas als de 120 dagen in de rest van het jaar niet meer haalbaar zijn. Dit volgt de definitie van Weidemelk in het Convenant Weidegang; de zuivelonderneming bepaalt of je in aanmerking komt.

## Beweidingsplatform en veebezetting {#veebezetting}

Het beweidingsplatform is de oppervlakte grasland die in het jaar tot en met vandaag is beweid. Per perceel telt het beweide deel:

- het hele perceel als een beweiding het hele perceel besloeg;
- anders alle zones op het perceel samen, zodat opeenvolgende stroken optellen in plaats van één strook te tellen;
- een deel zonder plek op de kaart telt mee als het groter is dan de zones samen.

Een zone die buiten de perceelsgrens loopt, telt alleen voor het deel binnen het perceel.

De veebezetting op het platform is de GVE van de koppels die er hebben geweid, gedeeld door de oppervlakte van het platform. In een afgelopen jaar telt {{appName}} de dieren zoals ze op 31 december van dat jaar in de koppels zaten. Een koppel die in dat jaar heeft geweid maar al eerder is beëindigd, telt mee voor de weidedagen en uren, maar zonder dieren. De GVE per dier komt uit de diercategorieën van RVO. {{appName}} geeft de veebezetting een label: onder 2,0 GVE/ha _extensief_, van 2,0 tot 2,6 _gemiddeld_ en daarboven _intensief_. Dat label is indicatief: er is geen officiële indeling in extensieve en intensieve beweiding in GVE per hectare.

## Rustperiode {#rust}

Na een weidebeurt of maaisnede heeft gras tijd nodig om terug te groeien. {{appName}} meldt een rustperiode van minder dan 21 dagen in het groeiseizoen als aandachtspunt. Volgens het Handboek Melkveehouderij (tabel 3.8) kost het minstens 21 groeidagen om de weidesnede van 1.700 kg droge stof per hectare te bereiken, in de tweede helft van april bij een hoge stikstofgift; later in het seizoen en bij minder stikstof duurt het langer.

De rust is het aantal dagen tussen de laatste dag van het vorige gebruik en de eerste dag van het volgende: eindigt een beweiding op 4 mei en begint de volgende op 25 mei, dan is dat 21 dagen rust. Alleen een maaisnede van gras telt als gebruik, niet de oogst van een ander gewas op het perceel.

De rust telt per deel van het perceel. Een beweiding wordt vergeleken met het laatste eerdere gebruik van hetzelfde deel: een maaisnede of een beweiding van het hele perceel raakt het hele perceel, een zone alleen de stroken die ermee overlappen. Bij stripgrazen krijgt elke strook dus zijn eigen rust. Gebruik van hetzelfde deel op dezelfde tijd, zoals twee koppels tegelijk op één zone of dezelfde zone 's ochtends en 's middags, telt als één gebruik en niet als rust van 0 dagen. Dat geldt ook voor een reeks die elkaar overlapt, zoals 1 tot 5 mei, 3 tot 8 mei en 6 tot 10 mei: de zone is dan zonder pauze beweid, en de rust telt vanaf het begin van die reeks. Zo'n reeks telt per deel van het perceel: alleen gebruik dat hetzelfde deel raakt, hoort erbij. Zones tellen alleen voor het deel binnen het perceel. Een maaisnede of bemesting telt op de Nederlandse kalenderdag waarop je hem vastlegt.

Aannames:

- Het groeiseizoen begint voor deze controle op 15 februari. Het Handboek koppelt het begin van de grasgroei aan een temperatuursom, die in sommige jaren al begin februari wordt bereikt.
- De richtlijn houdt geen rekening met de werkelijke grasgroei op je bedrijf.

## Strookgrootte {#strook}

Bij **Strook berekenen** en in de planner rekent {{appName}} de grootte van een strook zo uit:

grasaanbod = aanbod bij inscharen + bijgroei per weidedag × aantal dagen

oppervlakte (ha) = aantal dieren × grasopname per dier per dag × aantal dagen ÷ grasaanbod

De richtwaarden die {{appName}} invult, kun je per keer aanpassen:

| Waarde                | Richtwaarde                                  | Bron                                                                                                                            |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Aanbod bij inscharen  | 1.700 kg ds/ha                               | Handboek Melkveehouderij §3.10.2 (omweiden) en tabel 3.8 (weidesnede)                                                           |
| Bijgroei per weidedag | 45 kg ds/ha                                  | Handboek Melkveehouderij §3.9.2: de bijgroei tijdens beweiden is ongeveer de helft van de normale groei (45 kg bij 300 kg N/ha) |
| Grasopname per dier   | maximaal 1 kg ds per weide-uur, tot 15 kg ds | Nieuw Nederlands Weiden: minimaal 1 weide-uur per kg ds opname; totale opname uit ruwvoer 15 kg ds per dag                      |

Aannames:

- Alle gras in het aanbod wordt opgegeten. Gras dat achterblijft bij uitscharen is niet afgetrokken; vul een lager aanbod in als je daarmee wilt rekenen.
- De grasopname is een bovengrens bij het aantal weide-uren. Bij dag en nacht weiden en voldoende groei kan een koe meer opnemen; in het voorbeeld van Nieuw Nederlands Weiden is dat 13,3 kg ds per dag bij een groei van 80 kg ds/ha per dag.

Een nieuwe strook sluit aan op de stroken die de afgelopen 28 dagen op het perceel zijn beweid. Het Handboek adviseert een perceel na maximaal 28 groeidagen weer in te scharen (§3.9.2); een strook die langer geleden is beweid, is weer vrij.

## Graslandgebruiksystemen {#systemen}

De planner gebruikt per systeem een standaard aantal dagen per perceel, volgens het Handboek Melkveehouderij §3.10.2 en, voor Nieuw Nederlands Weiden, de brochure van Stichting Weidegang:

| Systeem                 | Dagen per perceel of blok | Toelichting                                               |
| ----------------------- | ------------------------- | --------------------------------------------------------- |
| Omweiden                | 4                         | Inscharen bij ongeveer 1.700 kg ds/ha                     |
| Standweiden             | 21                        | Drie weken tot drie maanden op een perceel                |
| Modern standweiden      | 21                        | Na drie tot zes weken naar het volgende blok              |
| Nieuw Nederlands Weiden | 1                         | Elke dag een nieuw perceel van gelijke grootte, kort gras |
| Stripgrazen             | 1                         | Elke beweiding een nieuwe strook                          |
| Rantsoenbeweiding       | 1                         | Een nieuwe strook aansluitend op het eerder beweide land  |

Bij Nieuw Nederlands Weiden deel je de huiskavel eenmalig op in percelen van gelijke grootte. In alle voorbeelden van de brochure zijn dat percelen van 2,5 ha voor 120 koeien; de planner rekent die grootte om naar het aantal dieren in je koppel (een aanname). De koeien krijgen elke dag een nieuw perceel, en bij dag en nacht weiden (meer dan 12 uur) 's ochtends en 's avonds. Je schaart in bij 10 tot 12 cm graslengte en uit bij 9 tot 11 cm. De rust telt per perceel, omdat elk perceel als zone wordt vastgelegd. Groen Kennisnet beschrijft daarnaast een indeling van de percelen in drie blokken, waarbij de koeien na vier weken naar het volgende blok gaan. Die wisseling tussen blokken neemt de planner niet mee: hij laat de koeien elke dag naar het volgende perceel op de gekozen percelen gaan. Kies daarom de percelen van het blok dat je wilt beweiden.

De standaard van 8 weide-uren per dag is een aanname voor beperkt weiden; pas hem aan voor je bedrijf. Bij zomerstalvoedering en summerfeeding is er geen weidegang.

## Bronnen {#bronnen}

- [Handboek Melkveehouderij 2023-2024, hoofdstuk 3 Grasland en voedergewassen](https://backend.wur.nl/sites/default/files/2025-10/Handboek_Melkveehouderij-H3-NL-2023.pdf), Wageningen Livestock Research: §3.9 Grasgroei en §3.10 Graslandgebruik.
- [Nieuw Nederlands Weiden: eenvoudig, goed weiden](https://www.stichtingweidegang.nl/images/downloads/Nieuw_Nederlands_Weiden_Eenvoudig_goed_weiden.pdf), Stichting Weidegang.
- [Graslandbeheer en beweidingssystemen](https://wiki.groenkennisnet.nl/space/BB/11862027/4.1.1+Graslandbeheer+en+beweidingssystemen), Groen Kennisnet.
