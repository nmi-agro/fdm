---
title: Bemestingsadvies
description: Lees het bemestingsadvies per perceel en per nutriënt, zie waar opbrengst- of milieurisico's zitten en voeg direct een bemesting toe.
section: Resultaten
order: 3
inApp:
  - Bemestingsadvies
routes:
  - farm.$b_id_farm.$calendar.nutrient_advice*
watch:
  - fdm-app/app/components/blocks/nutrient-advice/**
  - fdm-calculator/src/nutrient-advice/**
keywords:
  - bemestingsadvies
  - Handboek Bodem en Bemesting
  - Adviesbasis Bemesting
  - NPK
  - spoorelementen
related:
  - background/bemestingsadvies
  - gebruiksruimte
---

Het bemestingsadvies vertelt je hoeveel een gewas nodig heeft voor een goede opbrengst, en hoe je huidige bemesting zich daartoe verhoudt. Het advies volgt het Handboek Bodem en Bemesting en de Adviesbasis Bemesting voor grasland en voedergewassen.

## Overzicht voor het bedrijf {#overzicht}

Open **Bemestingsadvies** in de zijbalk. Je ziet een tabel met per perceel het advies per nutriënt. Met **Per ha** of **Totaal** wissel je tussen het advies per hectare en het totaal voor het perceel.

## Het advies per perceel {#advies-per-perceel}

Klik op een perceel voor het volledige advies. Bovenaan staan twee kaarten:

- **Risico voor opbrengst**: bij welke nutriënten je minder geeft dan het advies. Dat kan opbrengst kosten.
- **Risico voor milieu**: bij welke nutriënten je meer geeft dan het advies. Dat kan verliezen naar het milieu geven.

Daaronder staat het advies in drie groepen:

| Groep                                    | Nutriënten                                                            |
| ---------------------------------------- | --------------------------------------------------------------------- |
| NPK                                      | Stikstof (werkzaam), fosfaat en kali                                  |
| Organische stof en secundaire nutriënten | Effectieve organische koolstof, zwavel, magnesium, calcium en natrium |
| Spoorelementen                           | Koper, zink, kobalt, mangaan, molybdeen en boor                       |

Per nutriënt zie je een balk met wat je hebt gegeven tegenover het advies, en de bemestingen die meetellen. Met **Toevoegen** voer je direct een extra bemesting in.

## Grasland: advies per snede {#grasland}

Bij grasland krijg je het stikstofadvies per snede. Je geeft per snede aan of het om beweiden of maaien gaat en hoe zwaar de snede is, van lichte beweiding tot zware maaisnede. Het advies past zich daarop aan.

## Let op {#let-op}

Het advies kan hoger zijn dan wat je volgens de gebruiksnormen mag geven. De wettelijke norm gaat dan altijd voor. Kan het advies niet worden berekend, dan staat er waarom, bijvoorbeeld omdat er geen gewas of bodemanalyse is.

Hoe het advies tot stand komt, lees je in [Bemestingsadvies](/manual/background/bemestingsadvies).
