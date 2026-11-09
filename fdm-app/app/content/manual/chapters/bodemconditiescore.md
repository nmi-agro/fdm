---
title: BodemConditieScore
description: Beoordeel een bodemkuil of profiel in het veld visueel. Je scoort negen kenmerken, legt foto's vast en ziet in één score hoe je bodem ervoor staat.
section: Gegevens vastleggen
order: 4
inApp:
  - Percelen
  - BodemConditieScore
routes:
  - farm.$b_id_farm.$calendar.field.$b_id.bcs*
watch:
  - fdm-app/app/components/blocks/soil-visual/**
  - fdm-app/app/lib/bcs*.ts
  - fdm-calculator/src/bcs/**
keywords:
  - BodemConditieScore
  - BCS
  - visuele bodembeoordeling
  - bodemstructuur
  - regenwormen
  - verdichting
related:
  - bodem
  - bodemkwaliteit
  - background/bln3-bodemkwaliteit
---

Met de BodemConditieScore (BCS) beoordeel je een bodemkuil of profiel in het veld visueel. Je kijkt naar negen kenmerken, zoals beworteling, regenwormen en verdichting. {{appName}} vult pH en organische stof aan uit je laatste bodemanalyse en rekent alles om naar één score. Die score telt ook mee in de [bodemindicatoren](/manual/bodemkwaliteit).

## Voorbereiden {#voorbereiden}

Graaf een bodemkuil, zodat je een schone profielwand ziet, en steek een bodemblok uit van ongeveer 20 × 20 × 20 cm. In dat blok tel je de regenwormen en beoordeel je de structuur. Neem je telefoon mee als je foto's wilt maken.

Voor pH en organische stof gebruikt {{appName}} de meest recente [bodemanalyse](/manual/bodem) van het perceel. Heb je die nog niet ingevoerd, dan blijven deze twee onderdelen leeg.

## Een meting toevoegen {#meting-toevoegen}

1. Open het perceel via **Percelen**, ga naar **BodemConditieScore** en klik op **Nieuwe meting toevoegen**.
2. Vul de **Datum bemonstering** in. Daaronder zie je welke labanalyse {{appName}} gebruikt voor pH en organische stof. Met **Foto's kiezen** voeg je profiel-, oppervlakte- of detailfoto's toe, ook direct met de camera van je telefoon.
3. Beoordeel de kenmerken, één per stap. Bij elk kenmerk zie je **Wat beoordeel je?**, de **Werkwijze** en een **Fototip**. Klik onder **Kies de score** op de beschrijving die het best past en ga met **Volgende** verder. Met **Terug** ga je een stap terug.
4. Controleer de score en klik op **Bevestigen en opslaan**.

Je hoeft niet alles in te vullen: één kenmerk is genoeg om op te slaan. Houd er wel rekening mee dat een kenmerk dat je overslaat als 0 telt in de score. Bij een foto kun je een notitie of tekening plaatsen, bijvoorbeeld om een verdichte laag aan te wijzen.

## De negen kenmerken {#kenmerken}

Zes kenmerken laten zien hoe goed de bodem werkt. Je scoort ze als **Slecht**, **Matig** of **Goed**.

| Kenmerk                    | Wat je bekijkt                                                                                              | Goed is                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Gewasbedekking**         | Kijk recht van boven: welk deel van de bodem is bedekt met een levend gewas of plantenresten?               | Meer dan 70% bedekt. Slecht is minder dan 30%.     |
| **Beworteling**            | Bekijk de profielwand en breek een kluit open: hoe diep, dicht en vertakt zijn de wortels?                  | Diepe, fijn vertakte wortels.                      |
| **Verdichting ondergrond** | Voel met een spade of je hand de weerstand in de ondergrond. Let op platte structuren en dichte lagen.      | Kruimelig en goed doorwortelbaar, zonder plaatjes. |
| **Regenwormen**            | Tel de regenwormen in het bodemblok van ongeveer 20 × 20 × 20 cm.                                           | Meer dan 5. Slecht is 0 tot 2.                     |
| **Bodemstructuur**         | Neem het bodemblok in je hand: valt het uiteen in kruimels of in harde kluiten?                             | Kleine kruimels die makkelijk uiteenvallen.        |
| **Gekleurde vlekken**      | Zoek in de profielwand naar roest-, blauwe of grijze vlekken. Die wijzen op langdurig natte omstandigheden. | Geen of vrijwel geen vlekken.                      |

Drie kenmerken wijzen op problemen en kosten punten. Je scoort ze als **Geen**, **Enig** of **Veel**.

| Kenmerk          | Wat je bekijkt                                                                                  | Veel is                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Plasvorming**  | Blijft er water op het oppervlak staan na neerslag? Let op natte plekken en sporen van plassen. | Regelmatig of veel plassen op het oppervlak.                |
| **Scheuren**     | Is de toplaag opengescheurd? Let op de diepte en hoe dicht de scheuren bij elkaar liggen.       | Veel of diepe scheuren over een groot deel van het perceel. |
| **Spoorvorming** | Loop over het perceel: hoe diep en ernstig zijn wielsporen, hoefafdrukken of vertrapping?       | Diepe of ernstige sporen of vertrapping.                    |

De fototip in de app helpt je een bruikbare foto te maken, bijvoorbeeld een overzichtsfoto recht van boven voor de gewasbedekking of een schuine foto over het oppervlak voor scheuren.

## Zo lees je de score {#score}

Elk kenmerk krijgt 0, 1 of 2 punten. {{appName}} vermenigvuldigt die punten met een weging en telt alles op:

| Onderdeel                                                                               | Weging       |
| --------------------------------------------------------------------------------------- | ------------ |
| Beworteling, verdichting ondergrond, regenwormen, bodemstructuur, pH en organische stof | × 3          |
| Gewasbedekking                                                                          | × 2          |
| Gekleurde vlekken                                                                       | × 1          |
| Plasvorming                                                                             | − 2 per punt |
| Scheuren en spoorvorming                                                                | − 1 per punt |

pH en organische stof vul je niet zelf in. {{appName}} leidt ze af uit je laatste bodemanalyse: de pH ten opzichte van de gewenste pH voor je grondsoort en bouwplan, de organische stof ten opzichte van wat gebruikelijk is voor je grondsoort en gewastype. Op klei- en lössgrond is voor de pH ook het lutumgehalte nodig. Ontbreekt er iets, dan staat het onderdeel op **Onbekend** en telt het als 0.

De totaalscore is nooit lager dan 0. Bij 40 punten of meer zit je op de maximale score. Het oordeel hangt af van het totaal:

| Score       | Oordeel         |
| ----------- | --------------- |
| Onder de 10 | **Slecht**      |
| 10 tot 20   | **Onvoldoende** |
| 20 tot 30   | **Matig**       |
| 30 tot 40   | **Goed**        |
| 40 of meer  | **Zeer goed**   |

In het **Overzicht** van een meting zie je de score, het percentage van de maximale score en de deelscores per onderdeel. Kenmerken die punten kosten, staan daar met een minteken.

## Bekijken en aanpassen {#bekijken-en-aanpassen}

Onder **BodemConditieScore** op de perceelpagina staan al je metingen. Open een meting om de score, de deelscores en de foto's met notities te zien. Met **Bewerken** pas je de datum, de scores of de foto's aan en klik je op **Wijzigingen opslaan**. Wil je een score weer leeg maken, klik dan nog een keer op de gekozen score. Met **Verwijderen** haal je een meting weg.
