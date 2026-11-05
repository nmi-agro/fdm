---
title: Meststoffen en bemesting
description: Beheer je meststoffenlijst, voeg een eigen meststof met mestanalyse toe en voer bemestingen in voor één of meerdere percelen.
section: Gegevens vastleggen
order: 4
inApp:
  - Meststoffen
routes:
  - farm.$b_id_farm.fertilizers*
  - farm.$b_id_farm.$calendar.field.$b_id.fertilizer._index.tsx
  - farm.$b_id_farm.$calendar.field.fertilizer._index.tsx
  - farm.$b_id_farm.$calendar.field.modify_fertilizer.$p_id.tsx
watch:
  - fdm-app/app/components/blocks/fertilizer/**
  - fdm-app/app/components/blocks/fertilizer-applications/**
keywords:
  - meststof toevoegen
  - drijfmest
  - mestanalyse
  - bemesting invoeren
  - toedieningsmethode
related:
  - bouwplan
  - gebruiksruimte
  - bemestingsadvies
---

Elk bedrijf krijgt bij het aanmaken een standaardlijst met meststoffen mee. Gebruik je een eigen product, zoals je eigen drijfmest met een eigen analyse, dan voeg je dat zelf toe.

## Je meststoffenlijst {#meststoffen}

Onder **Meststoffen** in de zijbalk zie je alle meststoffen van het bedrijf, met hun gehaltes aan onder meer stikstof, N-werking, fosfaat, kali en droge stof, en de mestcode van RVO. Producten die je zelf hebt toegevoegd, herken je aan het label **Eigen meststof**.

## Een eigen meststof toevoegen {#meststof-toevoegen}

1. Klik op **Meststof toevoegen**.
2. Kies **Zelf samenstellen** om met een leeg formulier te beginnen, of **Kies uit lijst** om een bestaand product als basis te nemen. Dat laatste is handig als je product lijkt op iets uit de lijst: je hoeft dan alleen de afwijkende gehaltes aan te passen.
3. Vul de **Naam**, de **Mestcode (RVO)** en de **Voorkeurseenheid** in (kg/ha, ton/ha, l/ha of m³/ha), en vink aan hoe je de meststof toedient.
4. Vul de gehaltes in, bijvoorbeeld uit je mestanalyse. Vul je stikstof in, dan vraagt de app ook de **N-werking**. Kies je liters of kubieke meters als eenheid, dan is ook de **Dichtheid** nodig.
5. Klik op **Meststof opslaan**.

Producten uit de standaardlijst kun je niet wijzigen, maar wel kopiëren met **Gebruik als sjabloon**.

## Een bemesting invoeren {#bemesting-invoeren}

Je kunt een bemesting op drie plekken invoeren. Kies wat het snelst is:

| Situatie                          | Waar?                                               |
| --------------------------------- | --------------------------------------------------- |
| Eén perceel                       | Perceelpagina → **Bemesting** → **Toevoegen**       |
| Een paar losse percelen           | **Percelen** → vink de percelen aan → **Bemesting** |
| Alle percelen met hetzelfde gewas | **Bouwplan** → vink het gewas aan → **Bemesting**   |

Het formulier is overal hetzelfde:

- **Meststof**: kies het product. Staat het er niet tussen? Klik op het plusje om een nieuwe meststof aan te maken. Wat je al had ingevuld, blijft bewaard.
- **Toedieningsmethode**: bijvoorbeeld Zodenbemester / Sleepvoet, Mestinjectie of Breedwerpig uitstrooien. Welke methodes je kunt kiezen, hangt af van de meststof.
- **Hoeveelheid**: in de eenheid van de meststof, bijvoorbeeld 30 m³/ha of 300 kg/ha.
- **Datum**.

## Wat doet die bemesting? {#effect}

Op de perceelpagina onder **Bemesting** zie je naast je giften direct wat je bemesting betekent voor de [gebruiksnormen](/manual/gebruiksruimte), de [stikstofbalans](/manual/balansen) en het [bemestingsadvies](/manual/bemestingsadvies). Zo zie je meteen of je nog ruimte hebt of al boven het advies zit. Het perceel moet daarvoor wel een gewas hebben.
