---
title: Veestapel
description: Leg je melkvee vast in koppels, houd het aantal dieren bij en registreer per dier oormerk, koppel en afvoer. De basis voor beweiding en veebezetting.
section: Gegevens vastleggen
order: 8
inApp:
  - Melkvee
  - Veestapel
routes:
  - farm.$b_id_farm.$calendar.livestock*
watch:
  - fdm-app/app/components/blocks/livestock/**
keywords:
  - veestapel
  - melkvee
  - koppel
  - jongvee
  - GVE
  - dieren registreren
related:
  - beweiding
  - background/beweiding
---

In {{appName}} leg je je melkvee vast in koppels: groepen dieren die samen worden gehouden en samen weiden, zoals de melkkoeien of het jongvee. Elke koppel hoort bij een diercategorie van RVO, en daarmee weet {{appName}} hoeveel grootvee-eenheden (GVE) een dier telt. Met je veestapel leg je daarna de [beweiding](/manual/beweiding) vast en zie je de veebezetting op je grasland.

## Je eerste koppel {#eerste-koppel}

Heeft je bedrijf nog geen dieren, dan zie je in het menu **Melkvee toevoegen**. Daar maak je je eerste koppel aan:

1. Kies de diercategorie, bijvoorbeeld melk- en kalfkoeien. {{appName}} vult een naam voor de koppel in, die je kunt aanpassen.
2. Vul het aantal dieren in.
3. Klik op **Koppel aanmaken**.

{{appName}} maakt het aantal dieren aan zonder oormerk. Voor beweiding en veebezetting is het aantal genoeg; oormerk en levensnummer kun je later per dier aanvullen. Na het opslaan ga je direct door naar de beweidingskalender.

Vanaf dat moment staat in het menu de groep **Melkvee**, met **Veestapel** en **Beweiding**.

## Koppels beheren {#koppels}

Op **Veestapel** zie je een kaart per koppel, met het aantal dieren, de GVE en of de koppel nu weidt. Onderaan staan het totaal aantal dieren, de GVE en de veebezetting op je grasland in GVE per hectare.

![De veestapel met een kaart per koppel](screenshot:veestapel-overzicht)

- _Aantal aanpassen:_ met de plus en min op de kaart. Met de plus voeg je dieren zonder oormerk toe. Met de min voer je een dier af; je bevestigt dat met **Afvoeren bevestigen**. Dieren zonder oormerk worden als eerste afgevoerd.
- _Nog een koppel:_ klik op **Koppel toevoegen**, bijvoorbeeld voor droogstaande koeien of jongvee.
- _Via het menu op de kaart:_ **Naam wijzigen**, **Dieren verplaatsen naar andere koppel** en **Koppel verwijderen**. Een koppel met dieren kun je pas verwijderen als je de dieren hebt afgevoerd of verplaatst.

Het aantal dieren in een koppel wordt niet apart opgeslagen: {{appName}} telt de dieren die op dat moment in de koppel zitten.

## Dieren {#dieren}

Met **Alle dieren bekijken** open je de lijst van alle dieren op het bedrijf. Je zoekt op werknummer of levensnummer en filtert op koppel. Een dier zonder oormerk heeft het label _Geen oormerk_. Met **Dier toevoegen** voeg je één dier toe en wijs je het direct aan een koppel toe.

Klik op een dier om de details te openen. Daar:

- vul je werknummer, oormerk, geslacht en geboortedatum aan en sla je ze op met **Wijzigingen opslaan**;
- verplaats je het dier naar een andere koppel met **Verplaats naar koppel**;
- leg je vast dat het dier het bedrijf verlaat, met datum en reden, met **Afvoer vastleggen**;
- zie je de beweidingshistorie van het dier en in welke koppels het heeft gelopen.

De diercategorie van de koppel bepaalt welk geslacht een dier mag hebben. Een dier in de koppel melk- en kalfkoeien is bijvoorbeeld altijd vrouwelijk.

## GVE en veebezetting {#gve}

Elke diercategorie heeft een vast aantal GVE per dier, uit de diercategorieën van RVO: een melkkoe telt als 1 GVE, jongvee minder. De GVE van een koppel is het aantal dieren maal die factor. De veebezetting op de pagina **Veestapel** is de GVE van alle koppels gedeeld door de oppervlakte grasland van het bedrijf (zonder bufferstroken).

Hoe {{appName}} de veebezetting op het beweidingsplatform berekent, lees je in de [achtergrond bij beweiding](/manual/background/beweiding#veebezetting).
