---
title: Gerrit, de AI-bemestingsassistent
description: Laat Gerrit een bemestingsplan voor je hele bedrijf voorstellen dat rekening houdt met de gebruiksnormen, het bemestingsadvies en je eigen wensen.
section: Resultaten
order: 6
inApp:
  - Labs
  - Gerrit
routes:
  - farm.$b_id_farm.$calendar.gerrit.tsx
  - api.gerrit.*
watch:
  - fdm-app/app/components/blocks/gerrit/**
  - fdm-app/app/lib/gerrit.server.ts
  - fdm-app/app/lib/gerrit-limit.server.ts
keywords:
  - Gerrit
  - AI bemestingsplan
  - bemestingsplan maken
  - mestruimte opvullen
  - AI-assistent landbouw
related:
  - background/gerrit
  - bemesting
  - bemestingsplan
---

Gerrit stelt in één keer een bemestingsplan voor je hele bedrijf voor: welke meststof, hoeveel, wanneer en hoe, per perceel. Daarbij houdt Gerrit rekening met de gebruiksnormen, het bemestingsadvies, de stikstofbalans en jouw wensen. Gerrit is een AI-assistent: het plan is een voorstel. Jij of je adviseur beoordeelt het voordat het wordt toegepast.

Je vindt Gerrit in de zijbalk onder **Labs**. Gerrit is voor iedereen beschikbaar en werkt voor de jaren 2025 en 2026.

## Wat heb je nodig? {#voorbereiding}

- Percelen met een hoofdgewas voor het gekozen jaar. Bufferstroken en percelen kleiner dan 0,5 ha worden niet meegenomen.
- Meststoffen in je [meststoffenlijst](/manual/bemesting#meststoffen). Gebruik je eigen mest met een eigen analyse, [voeg die dan eerst toe](/manual/bemesting#meststof-toevoegen): dan rekent Gerrit met jouw gehaltes.
- Bodemanalyses maken het advies, en daarmee het plan, nauwkeuriger. Zonder analyse rekent Gerrit met geschatte bodemwaarden.

## Een plan laten maken {#plan-maken}

1. Klik in de zijbalk op **Gerrit** en controleer of het juiste jaar is gekozen.
2. Stel onder **Bedrijfsstrategie & voorkeuren** in waar Gerrit rekening mee moet houden:

| Keuze                            | Wat doet Gerrit?                                                            |
| -------------------------------- | --------------------------------------------------------------------------- |
| **Biologisch bedrijf**           | Gebruikt geen kunstmest                                                     |
| **Opvullen mestruimte**          | Probeert de gebruiksruimte voor dierlijke mest zo goed mogelijk te benutten |
| **Ammoniakemissies verminderen** | Kiest emissiearme meststoffen en toedieningsmethodes                        |
| **Inzetten op doelsturing**      | Houdt het stikstofoverschot onder de doelwaarde                             |
| **Bouwplanniveau**               | Geeft percelen met hetzelfde gewas dezelfde bemesting                       |

Voor 2025 kun je ook derogatie aanzetten (geen fosfaathoudende kunstmest), en vanaf 2026 Renure-producten. Een aantal keuzes staat al aan op basis van je bedrijfsgegevens, zoals een biologisch certificaat.

3. Kies onder **Meststoffenselectie** welke meststoffen Gerrit mag gebruiken. Standaard zijn dat alle meststoffen van je bedrijf.
4. Schrijf eventueel je wensen op bij **Aanvullende opmerkingen of wensen**, bijvoorbeeld "Gebruik bij voorkeur eigen drijfmest op de huiskavel".
5. Klik op **Bemestingsplan genereren**.

Gerrit bekijkt eerst je bedrijf en stelt soms een paar gerichte vragen, bijvoorbeeld over de huiskavel of over je mest. Beantwoord de vragen die voor jou van toepassing zijn en klik op **Doorgaan met deze antwoorden**, of klik op **Vragen overslaan**.

Daarna gaat Gerrit aan het werk. Je ziet welke stappen Gerrit zet: gegevens verzamelen, de teelthandleiding raadplegen, het bemestingsadvies ophalen, de gebruiksruimte berekenen, meststoffen zoeken en het plan doorrekenen. Dat duurt meestal een paar minuten. Blijf op de pagina; ga je weg, dan wordt de berekening afgebroken.

## Het voorstel beoordelen {#beoordelen}

Je krijgt het **Voorgesteld bemestingsplan**: per perceel het gewas, de oppervlakte en de voorgestelde bemestingen met meststof, hoeveelheid, datum en toedieningsmethode. Klik op een perceel voor de details: de gebruiksruimte, de stikstofbalans, de organische-stofbalans en hoe het plan zich verhoudt tot het advies per nutriënt.

Daarnaast zie je voor het hele bedrijf:

- **Bedrijfsnormen**: hoeveel van de gebruiksruimte het plan opvult.
- De stikstofbalans op bedrijfsniveau, met het doel en of je daarbinnen blijft.
- **Toelichting van Gerrit**: waarom Gerrit voor deze aanpak kiest.

Alle getallen in het voorstel worden door {{appName}} zelf doorgerekend, met dezelfde rekenregels als in de rest van de app. Hoe dat werkt, lees je in [Gerrit: zo werkt het](/manual/background/gerrit).

Controleer vooral of het plan binnen de gebruiksnormen van je bedrijf blijft. Een overschrijding wordt rood gemarkeerd, maar niet tegengehouden. Niet tevreden? Klik op **Wijzig & herbereken**, pas je keuzes of wensen aan en laat een nieuw plan maken.

Met **Ja** of **Nee** bij "Is dit bemestingsplan van Gerrit behulpzaam?" help je Gerrit verbeteren.

## Het plan toepassen {#toepassen}

Tevreden? Klik op **Plan definitief maken en toepassen**. Gerrit zet de bemestingen dan in je bedrijf, en je gaat naar het [bouwplan](/manual/bouwplan).

> Let op: toepassen vervangt _alle_ bemestingen van dat jaar op _alle_ percelen van het bedrijf door het voorstel van Gerrit, ook op percelen die niet in het plan staan. Er volgt geen extra bevestiging. Heb je al bemestingen ingevoerd die je wilt houden? Kijk het voorstel dan extra goed na, of voer die bemestingen daarna opnieuw in.

Wil je het plan op papier of meegeven aan een teler? Maak daarna een [bemestingsplan als PDF](/manual/bemestingsplan).

## Goed om te weten {#goed-om-te-weten}

- Je kunt Gerrit een beperkt aantal keer per dag een plan laten maken. Bij "Gebruikt vandaag" zie je hoeveel plannen je vandaag nog hebt. Alleen een plan dat klaar is, telt mee.
- Gerrit werkt alleen voor 2025 en 2026. Kies je een ander jaar, dan vraagt Gerrit je om naar een van deze jaren te wisselen.
- Gerrit is een AI-systeem en geen menselijke adviseur. Het voorstel is een niet-bindend advies. De eindverantwoordelijkheid voor de bemesting ligt bij de teler.
