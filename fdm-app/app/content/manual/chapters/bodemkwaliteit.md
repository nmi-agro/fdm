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
  - fdm-app/app/lib/farm-measures.server.ts
  - fdm-app/app/lib/measure-labels.ts
  - fdm-app/app/lib/measures-catalogue.ts
  - fdm-calculator/src/bln3/**
keywords:
  - BLN3
  - bodemkwaliteit
  - bodemindicatoren
  - maatregelen
  - maatregelencatalogus
  - bodemgezondheid
related:
  - background/bln3-bodemkwaliteit
  - bodem
updated: 2026-11-10
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

## Maatregelencatalogus {#maatregelencatalogus}

De **Maatregelencatalogus** bevat alle maatregelen die je kunt vastleggen, voor het bedrijf en het jaar waarin je werkt. Je opent hem onder Maatregelen met de knop **Maatregelencatalogus**, rechts naast de titel. Bij een maatregel in je bedrijf, in de lijst bij **Maatregel toevoegen** of in de aanbevelingen opent een icoontje de maatregel in de catalogus in een nieuw tabblad.

Je kunt zoeken op naam, code of beschrijving; met de toets `/` spring je naar het zoekveld. Met **Sorteer** zet je de maatregelen op naam, op code of met **Meest aanbevolen** bovenaan de maatregelen die op de meeste percelen worden aanbevolen. Onder **Meer filters** filter je ook op effect, kosten en thema. Je zoekopdracht en filters blijven bewaard in de link, zodat je ze kunt delen of met Terug terugkomt op dezelfde lijst. Met **Status** kies je welke maatregelen je ziet; achter elke status staat hoeveel maatregelen die status hebben:

| Status         | Betekenis                                                                             |
| -------------- | ------------------------------------------------------------------------------------- |
| **Toegepast**  | De maatregel is dit jaar vastgelegd op een of meer percelen (vinkje)                  |
| **Aanbevolen** | De maatregel staat bij de aanbevolen maatregelen van een perceel (groene sterretjes)  |
| **Toepasbaar** | De maatregel kan op een perceel worden genomen, maar is niet aanbevolen (open rondje) |

De status per perceel wordt na de lijst geladen; dat kan even duren. Lukt het niet om de aanbevolen of toepasbare maatregelen op te halen, dan zie je een melding boven de lijst en staat achter die status "(niet beschikbaar)". Een maatregel zonder aanbeveling is dan niet per se ongeschikt. Met **Opnieuw proberen** haal je de status opnieuw op.

Per maatregel zie je eerst wat hij inhoudt en op welke percelen hij is toegepast, aanbevolen of toepasbaar; elk perceel linkt naar zijn maatregelen. Daarna zie je wat de maatregel kost (laag, gemiddeld of hoog), op welke indicatoren hij effect heeft en hoe groot dat effect is, wanneer hij van toepassing is, met welke maatregelen hij niet samen kan, en verwijzingen naar andere regelingen met een link naar de bron. Wordt de maatregel op je bedrijf aanbevolen, dan zie je bij elke indicator op hoeveel percelen hij die indicator verbetert.

Wil je de maatregel nemen? Klik dan op **Toevoegen aan percelen**, rechts naast de titel. Je gaat naar Maatregelen met de maatregel al gekozen, en de percelen waarop hij wordt aanbevolen al aangevinkt. Maatregelen op bedrijfsniveau kun je niet per perceel vastleggen; daar staat de knop niet bij.

Bij **Vast effect** is het effect op elke indicator een vaste waarde, gelijk voor alle percelen (in BLN: kwalitatief). Bij **Hangt af van perceel** hangt het effect af van de omstandigheden op het perceel, zoals grondsoort, gewas of fosfaattoestand (in BLN: geclassificeerd).

## Goed om te weten {#goed-om-te-weten}

BLN3 is nog in ontwikkeling. De scores en de lijst met maatregelen zijn nog niet definitief. Voor de berekening is een bodemanalyse nodig; de [BodemConditieScore](/manual/bodemconditiescore) wordt meegenomen als je die hebt ingevuld. Bufferstroken en natuurpercelen krijgen geen score.

Voor organisaties is er een overzicht van de indicatoren en maatregelen over alle bedrijven heen, met een kaart van de scores per perceel.
