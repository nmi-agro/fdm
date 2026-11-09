---
title: Samenwerken
description: Geef je adviseur, een collega of een organisatie toegang tot je bedrijf, kies de juiste rol en werk samen in organisaties.
section: Samenwerken en account
order: 1
inApp:
  - Instellingen
  - Toegang
routes:
  - farm.$b_id_farm.settings.access.tsx
  - farm.create.$b_id_farm.$calendar.access.tsx
  - organization*
watch:
  - fdm-app/app/components/blocks/access/**
  - fdm-app/app/components/blocks/organization/**
  - fdm-app/app/components/blocks/farm-groups/**
keywords:
  - toegang geven
  - adviseur uitnodigen
  - rollen
  - organisatie
related:
  - bedrijf-aanmaken
  - account
---

Je hoeft een bedrijf niet alleen te beheren. Je kunt je adviseur, een collega of een hele organisatie toegang geven. De rol die je iemand geeft, bepaalt wat diegene mag.

## Rollen bij een bedrijf {#rollen}

| Rol             | Wat mag je?                                                                                | Voor wie?                                   |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- |
| **Eigenaar**    | Alles bekijken en wijzigen, mensen uitnodigen, rollen aanpassen en het bedrijf verwijderen | Meestal de teler zelf                       |
| **Adviseur**    | Alles bekijken en wijzigen, maar geen mensen beheren                                       | De adviseur die het bedrijf bijhoudt        |
| **Onderzoeker** | Alleen bekijken                                                                            | Onderzoekers en beleidsmakers die meekijken |

Een bedrijf heeft altijd minstens één eigenaar.

## Iemand toegang geven {#toegang}

1. Open het bedrijf, ga naar **Instellingen** en kies **Toegang**. Alleen een eigenaar kan dit.
2. Zoek de persoon of organisatie onder **Zoek naar een gebruiker of organisatie**. Heeft diegene nog geen account? Typ dan het e-mailadres; er gaat een uitnodiging naartoe.
3. Kies de rol en klik op **Uitnodigen**.

![Toegang tot een bedrijf delen met een gebruiker of organisatie](screenshot:toegang-delen)

De ander ziet de uitnodiging op **Mijn bedrijven** en klikt op **Accepteren**. Wil je iemand later een andere rol geven of de toegang intrekken? Dat doe je in dezelfde lijst.

## Organisaties {#organisaties}

Werk je met meerdere mensen aan meerdere bedrijven, bijvoorbeeld als adviesbureau, studieclub of overheid? Maak dan een organisatie aan. Je geeft een bedrijf dan toegang aan de hele organisatie in plaats van aan elke collega apart.

1. Ga via je naam onderaan de zijbalk naar **Organisaties** en klik op **Nieuwe organisatie**.
2. Vul de **Naam organisatie**, een **Organisatie ID** (alleen kleine letters, cijfers en streepjes) en een korte **Beschrijving** in. Een logo is optioneel.
3. Klik op **Aanmaken**.
4. Ga naar **Leden** en nodig collega's uit met hun e-mailadres en een rol: **Eigenaar**, **Beheerder** of **Lid**.

Eigenaren en beheerders kunnen leden uitnodigen, rollen aanpassen en de instellingen wijzigen.

## Overzichten voor organisaties {#overzichten}

Kies je in de zijbalk een organisatie, dan krijg je overzichten over alle bedrijven waar de organisatie toegang toe heeft, per jaar:

- **Bedrijven**: alle bedrijven met eigenaar, gewassen, gebruikte meststoffen en oppervlakte.
- **Balans**: de stikstof- en organische-stofbalans over alle bedrijven, en per bedrijf de afwijking van het gemiddelde.
- **Indicatoren**: de BLN3-bodemkwaliteit over alle bedrijven, ook op de kaart.
- **Maatregelen**: welke bodemmaatregelen er op welke bedrijven worden genomen.

Dit is vooral handig voor adviseurs die hun klanten willen vergelijken, en voor beleidsmakers en onderzoekers die een groep bedrijven volgen.
