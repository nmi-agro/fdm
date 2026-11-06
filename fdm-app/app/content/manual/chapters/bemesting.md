---
title: Meststoffen en bemesting
description: Voer bemestingen in en zie direct wat ze doen voor je gebruiksruimte, het bemestingsadvies en de stikstofbalans, ook met je eigen mestanalyse.
section: Gegevens vastleggen
order: 4
inApp:
  - Meststoffen
routes:
  - farm.$b_id_farm.fertilizers*
  - farm.$b_id_farm.$calendar.field.$b_id.fertilizer._index.tsx
  - farm.$b_id_farm.$calendar.field.fertilizer._index.tsx
  - farm.$b_id_farm.$calendar.field.modify_fertilizer.$p_id.tsx
  - farm.$b_id_farm.$calendar.rotation_.fertilizer._index.tsx
  - farm.$b_id_farm.$calendar.rotation_.modify_fertilizer.$p_id.tsx
watch:
  - fdm-app/app/components/blocks/fertilizer/**
  - fdm-app/app/components/blocks/fertilizer-applications/**
keywords:
  - bemesting invoeren
  - effect bemesting
  - gebruiksruimte berekenen
  - eigen mestanalyse
  - meststof toevoegen
  - drijfmest
related:
  - background/gebruiksruimte
  - background/bemestingsadvies
  - background/stikstofbalans
  - bouwplan
---

Elk bedrijf krijgt bij het aanmaken een standaardlijst met meststoffen mee. Je voert een bemesting in voor één perceel, een paar percelen of alle percelen met hetzelfde gewas. Terwijl je dat doet, laat {{appName}} meteen zien wat die bemesting betekent voor je gebruiksruimte, het bemestingsadvies en de stikstofbalans. Zo zie je vóór het opslaan of je nog ruimte hebt.

## Een bemesting invoeren {#bemesting-invoeren}

Kies de plek die het snelst is:

| Situatie                          | Waar?                                               |
| --------------------------------- | --------------------------------------------------- |
| Eén perceel                       | Perceelpagina → **Bemesting** → **Toevoegen**       |
| Een paar losse percelen           | **Percelen** → vink de percelen aan → **Bemesting** |
| Alle percelen met hetzelfde gewas | **Bouwplan** → vink het gewas aan → **Bemesting**   |

Het formulier is overal hetzelfde:

- **Meststof**: kies het product. Staat het er niet tussen? Maak het meteen aan met het plusje ernaast (zie [hieronder](#meststof-vanuit-formulier)).
- **Toedieningsmethode**: bijvoorbeeld Zodenbemester / Sleepvoet, Mestinjectie of Breedwerpig uitstrooien. Welke methodes je kunt kiezen, hangt af van de meststof.
- **Hoeveelheid**: in de eenheid van de meststof, bijvoorbeeld 30 m³/ha of 300 kg/ha.
- **Datum**.

Klik op **Voeg toe**. Pas je een bestaande gift aan, dan heet de knop **Opslaan**.

## Direct zien wat je bemesting doet {#effect}

Zodra je een meststof, hoeveelheid en datum hebt gekozen, rekent {{appName}} uit wat de gift doet. Je ziet "Effect berekenen…" en daarna een samenvatting naast het formulier. Er is nog niets opgeslagen: je kunt de hoeveelheid of de meststof aanpassen en direct zien wat er verandert.

De samenvatting heeft drie onderdelen, elk met een link naar de pagina met alle details:

| Onderdeel            | Wat zie je?                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gebruiksruimte       | Per norm (stikstof werkzaam, fosfaat, stikstof uit dierlijke mest en RENURE) hoeveel ruimte er is en hoeveel er na deze gift gebruikt is, voor het perceel of het bedrijf |
| **Bemestingsadvies** | Per nutriënt, zoals werkzame stikstof, fosfaat en kali, hoe de bemesting zich na deze gift verhoudt tot het advies                                                        |
| **Stikstofbalans**   | Aanvoer, afvoer en emissie, en het stikstofoverschot na deze gift                                                                                                         |

Bij één perceel wissel je bij de gebruiksruimte tussen **Gebruiksruimte perceel** en **Gebruiksruimte bedrijf**. De wettelijke gebruiksruimte geldt voor het hele bedrijf; een perceel kan dus boven zijn eigen norm uitkomen. In [Gebruiksruimte](/manual/background/gebruiksruimte) lees je hoe de normen worden bepaald.

> De gebruiksnormen in {{appName}} zijn indicatief en alleen bedoeld ter informatie. Raadpleeg voor de definitieve normen en je verantwoording altijd de officiële publicaties van RVO en je adviseur.

### Voor meerdere percelen tegelijk {#effect-meerdere-percelen}

Voer je een bemesting in via **Percelen** of **Bouwplan**, dan zie je de samenvatting voor de hele selectie, plus een tabel met per perceel het effect. Sorteer die tabel om snel te zien waar je op moet letten:

- **Aandachtspunten eerst**: percelen die boven een norm of het advies uitkomen, of waarvoor iets niet kon worden berekend.
- **Hoogste N-balans**: de percelen met het grootste stikstofoverschot.
- **Meeste N t.o.v. advies**: de percelen die het meest boven het stikstofadvies uitkomen.
- **Grootste oppervlakte**.

Zo pas je de hoeveelheid aan of laat je een perceel weg voordat je opslaat.

### Als er iets niet berekend kan worden {#effect-ontbreekt}

- "Voor dit perceel is geen advies beschikbaar" of "geen stikstofbalans beschikbaar": vaak ontbreekt een gewas of een bodemanalyse. Zie [Bodem](/manual/bodem) en [Percelen beheren](/manual/percelen).
- "De datum valt buiten het jaar": de datum ligt buiten het jaar dat je in de **Kalender** hebt gekozen, dus het effect kan niet worden berekend.
- Een perceel zonder het gekozen gewas wordt in het bouwplan niet meegenomen.

## Je meststoffenlijst {#meststoffen}

Onder **Meststoffen** in de zijbalk zie je alle meststoffen van het bedrijf, met hun gehaltes aan onder meer stikstof, N-werking, fosfaat, kali en droge stof, en de mestcode van RVO. Producten die je zelf hebt toegevoegd, herken je aan het label **Eigen meststof**.

## Een eigen meststof toevoegen {#meststof-toevoegen}

Gebruik je eigen drijfmest of een product met een eigen analyse? Voeg het dan toe als eigen meststof. Dat loont: de gebruiksruimte, het bemestingsadvies en de stikstofbalans rekenen dan met jouw gehaltes in plaats van met standaardwaarden.

1. Klik op **Meststof toevoegen**.
2. Kies **Zelf samenstellen** om met een leeg formulier te beginnen, of **Kies uit lijst** om een bestaand product als basis te nemen. Dat laatste is handig als je product lijkt op iets uit de lijst: je hoeft dan alleen de afwijkende gehaltes aan te passen.
3. Vul de **Naam**, de **Mestcode (RVO)** en de **Voorkeurseenheid** in (kg/ha, ton/ha, l/ha of m³/ha), en vink aan hoe je de meststof toedient.
4. Vul de gehaltes in, bijvoorbeeld uit je mestanalyse. Vul je stikstof in, dan vraagt de app ook de **N-werking**. Kies je liters of kubieke meters als eenheid, dan is ook de **Dichtheid** nodig.
5. Klik op **Meststof opslaan**.

Producten uit de standaardlijst kun je niet wijzigen, maar wel kopiëren met **Gebruik als sjabloon**.

### Vanuit het bemestingsformulier {#meststof-vanuit-formulier}

Merk je pas tijdens het invoeren van een bemesting dat je meststof ontbreekt? Klik dan op het plusje naast **Meststof**. Je maakt de meststof aan zonder het formulier te verlaten; wat je al had ingevuld, blijft bewaard. Daarna kies je de nieuwe meststof en rekent de samenvatting direct met jouw gehaltes.
