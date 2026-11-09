---
title: "Bodemkwaliteit: indicatoren en maatregelen"
description: Lees de BLN3-scores voor bodemkwaliteit van je bedrijf en percelen, en leg maatregelen vast die je neemt om je bodem te verbeteren.
section: Resultaten
order: 4
inApp:
  - Indicatoren
routes:
  - farm.$b_id_farm.$calendar.indicators*
  - farm.$b_id_farm.$calendar.measures*
  - organization.$slug.$calendar.indicators.tsx
  - organization.$slug.$calendar.measures.tsx
watch:
  - fdm-app/app/components/blocks/indicators/**
  - fdm-app/app/components/blocks/measures/**
  - fdm-calculator/src/bln3/**
keywords:
  - BLN3
  - bodemkwaliteit
  - bodemindicatoren
  - maatregelen
  - bodemgezondheid
related:
  - background/bln3-bodemkwaliteit
  - bodem
---

Onder **Indicatoren** zie je hoe gezond je bodem is volgens BLN3, de Bodemindicatoren voor Landbouwgronden in Nederland. BLN3 kijkt naar meer dan alleen de bemesting: ook naar water, klimaat, de nutriëntenkringloop en de productiefunctie van de bodem.

## Scores lezen {#scores-lezen}

Elke indicator krijgt een score van 0 tot 100.

| Score       | Betekenis                |
| ----------- | ------------------------ |
| 70 of hoger | Goed tot uitstekend      |
| 40 tot 70   | Matig, aandacht gewenst  |
| Onder 40    | Onvoldoende, actie nodig |

![De scores van de BLN-bodemkwaliteit voor een bedrijf](screenshot:bodemkwaliteit-scores)

Op bedrijfsniveau zie je een boom van thema's en indicatoren, de zwakste thema's en indicatoren, en welke percelen het meest bijdragen aan een lage score. Onder **Waar te beginnen** staan maatregelen die voor je bedrijf het meeste opleveren. Op perceelniveau zie je alle indicatoren met de aanbevolen maatregelen per indicator.

Met de schakelaar **Met maatregelen** / **Zonder maatregelen** zie je hoe de score verandert als je de aanbevolen maatregelen neemt. Met **Invoergegevens BLN3** zie je welke gegevens zijn gebruikt.

Wat de scores betekenen en hoe ze worden berekend, lees je in [BLN3-bodemkwaliteit](/manual/background/bln3-bodemkwaliteit).

## Maatregelen vastleggen {#maatregelen}

Neem je al maatregelen om je bodem te verbeteren? Leg ze dan vast onder **Maatregelen**, dan tellen ze mee in de scores.

1. Klik op **Maatregel toevoegen**. De maatregelen met de grootste verwachte impact staan bovenaan.
2. Kies de percelen waarop de maatregel geldt.
3. Kies de periode: **Doorlopend**, tot het einde van het teeltseizoen, of tot een vaste datum.
4. Sla op.

![De maatregelen voor bodemkwaliteit, met de verwachte impact](screenshot:maatregelen)

## Goed om te weten {#goed-om-te-weten}

BLN3 is nog in ontwikkeling. De scores en de lijst met maatregelen zijn nog niet definitief. Voor de berekening is een bodemanalyse nodig; de [BodemConditieScore](/manual/bodemconditiescore) wordt meegenomen als je die hebt ingevuld. Bufferstroken en natuurpercelen krijgen geen score.

Voor organisaties is er een overzicht van de indicatoren en maatregelen over alle bedrijven heen, met een kaart van de scores per perceel.
