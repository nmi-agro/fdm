---
title: Percelen beheren
description: Open een perceel, voeg gewassen en oogsten toe, pas de perceelgegevens aan of verwijder een perceel dat je niet meer gebruikt.
section: Gegevens vastleggen
order: 1
inApp:
  - Percelen
routes:
  - farm.$b_id_farm.$calendar.field.tsx
  - farm.$b_id_farm.$calendar.field.$b_id.tsx
  - farm.$b_id_farm.$calendar.field.$b_id._index.tsx
  - farm.$b_id_farm.$calendar.field.$b_id.cultivation*
  - farm.$b_id_farm.$calendar.field.$b_id.settings.tsx
  - farm.$b_id_farm.$calendar.field.$b_id.delete.tsx
watch:
  - fdm-app/app/components/blocks/field/**
  - fdm-app/app/components/blocks/fields/**
  - fdm-app/app/components/blocks/field-dashboard/**
  - fdm-app/app/components/blocks/cultivation/**
  - fdm-app/app/components/blocks/harvest/**
keywords:
  - perceel
  - gewas toevoegen
  - oogst
  - snede
  - bufferstrook
related:
  - bouwplan
  - bodem
  - bemesting
---

Elk perceel heeft een eigen pagina met alles wat erbij hoort: gewassen, oogsten, bemestingen, bodem en de resultaten van de berekeningen. Werk je aan één perceel tegelijk, dan ben je hier op de goede plek. Wil je meerdere percelen tegelijk aanpassen, kijk dan bij het [Bouwplan](/manual/bouwplan).

## Een perceel openen {#perceel-openen}

Ga naar **Percelen** in de zijbalk en klik op een perceel, of kies het via **Kies een perceel**. In de percelentabel kun je zoeken op naam, gewas of meststof.

![De percelentabel van een bedrijf](screenshot:percelen-lijst)

## Wat staat er op de perceelpagina? {#perceelpagina}

| Onderdeel              | Wat je er vindt                                                                                                                                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overzicht**          | Een dashboard met tegels: kaart, perceeldetails, hoofdgewas, gewashistorie, bemestingen, bemestingsadvies, gebruiksruimte, stikstof- en organische-stofbalans, bodem, BLN-bodemkwaliteit en maatregelen. Is een tegel nog leeg, dan staat er direct een knop bij, zoals **Gewas toevoegen** of **Bodemanalyse toevoegen**. |
| **Gewassen**           | De gewassen op dit perceel en hun oogsten.                                                                                                                                                                                                                                                                                 |
| **Bemesting**          | Alle bemestingen op dit perceel, plus het Bemestingsdashboard.                                                                                                                                                                                                                                                             |
| **Bodem**              | De bodemanalyses en de meest recente waarde per bodemparameter.                                                                                                                                                                                                                                                            |
| **BodemConditieScore** | Je visuele bodembeoordelingen in het veld, zie [BodemConditieScore](/manual/bodemconditiescore).                                                                                                                                                                                                                           |
| **Gegevens**           | Naam, eigendom of pacht, bufferstrook en de periode dat het perceel in gebruik is.                                                                                                                                                                                                                                         |
| **Verwijderen**        | Het perceel verwijderen, met alles wat erbij hoort.                                                                                                                                                                                                                                                                        |

![Het overzicht van een graslandperceel, met tegels voor gewas, bemesting, bodem en resultaten](screenshot:perceel-pagina)

Het Overzicht is een fijne plek om te zien wat er nog ontbreekt. Een lege tegel betekent meestal dat er een stukje informatie mist voor een berekening.

## Een gewas toevoegen {#gewas-toevoegen}

1. Ga naar **Gewassen** en klik op **Gewas toevoegen**.
2. Kies het **Gewas** en vul de **Zaaidatum** in. Een **Einddatum** is optioneel.
3. Klik op **Voeg toe**.

![De gewassen van een perceel, met de knop om een gewas toe te voegen](screenshot:gewas-toevoegen)

Soms doet {{appName}} al een voorstel op basis van de BRP-registratie, bijvoorbeeld "We denken dat hier wintertarwe geteeld werd". Klopt dat? Klik dan op **Voorstel toevoegen** en bevestig.

Klik daarna op het gewas om meer in te vullen, zoals de **Variëteit** of, bij granen, of je de **Gewasresten** op het land achterlaat.

## Een oogst toevoegen {#oogst-toevoegen}

Klik bij het gewas op **Oogst toevoegen**. Bij grasland heet dit **Snede toevoegen**, omdat je daar meerdere keren per jaar maait.

- Vul de **Oogstdatum** in (bij gras: **Maaidatum**). Die moet binnen de teeltperiode van het gewas liggen.
- Vul de opbrengst en de kwaliteitsgegevens in die de app vraagt. Welke dat zijn, hangt af van het gewas: bij gras bijvoorbeeld de opbrengst in kg droge stof per ha en het ruw-eiwitgehalte, bij aardappelen de opbrengst aan versproduct en het onderwatergewicht.

Waarom die gegevens? Ze bepalen hoeveel stikstof er met de oogst van het perceel afgaat, en dat is nodig voor de [stikstofbalans](/manual/background/stikstofbalans).

## Perceelgegevens aanpassen {#perceelgegevens}

Onder **Gegevens** wijzig je de **Perceelsnaam**, geef je aan of het perceel in **Eigendom of pacht** is, of het een **Bufferstrook** is, en vanaf wanneer (en eventueel tot wanneer) je het perceel in gebruik hebt. Klik op **Bijwerken**.

Een bufferstrook telt in de meeste berekeningen bewust niet mee, zoals in de balansen, het bemestingsadvies en de bodemindicatoren.

## Een perceel verwijderen {#perceel-verwijderen}

Onder **Verwijderen** klik je op **Perceel verwijderen**. Daarmee verdwijnen ook de gewassen, bemestingen, bodemanalyses en oogsten van dat perceel. Dit kun je niet ongedaan maken. Is een perceel alleen niet meer in gebruik? Vul dan liever onder Gegevens een einddatum in, dan blijft de geschiedenis bewaard.
