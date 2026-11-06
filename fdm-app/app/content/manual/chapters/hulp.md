---
title: Hulp nodig?
description: Stel een vraag via Ondersteuning, volg je tickets en vind snel een antwoord op de meest gestelde vragen over {{appName}}.
section: Samenwerken en account
order: 4
inApp:
  - Ondersteuning
routes:
  - support.new.tsx
  - support._ticketviewer*
watch:
  - fdm-app/app/components/blocks/helpdesk/**
keywords:
  - ondersteuning
  - helpdesk
  - veelgestelde vragen
  - FAQ
related:
  - zo-werkt-het
  - aan-de-slag
---

Loop je ergens tegenaan, heb je een vraag, of zie je iets wat niet klopt? Laat het ons weten via **Ondersteuning**, onderaan de zijbalk. Ook ideeën en verbeterpunten zijn daar welkom.

## Een vraag stellen {#vraag-stellen}

1. Klik onderaan de zijbalk op **Ondersteuning**.
2. Kies onder **Mijn vraag gaat over** het bedrijf waar het om gaat, of **Geen specifiek bedrijf**.
3. Beschrijf je vraag of probleem. Hoe concreter, hoe sneller we je kunnen helpen: welk perceel, welke pagina, wat deed je en wat ging er mis?
4. Voeg eventueel een schermafbeelding of bestand toe (maximaal 5 bestanden van 25 MB).
5. Klik op **Verzenden**.

Meestal reageert een collega binnen een paar werkdagen. Onder **Mijn tickets** volg je de status van je vragen en reageer je met **Nieuw bericht**. Je krijgt ook een e-mail als er een antwoord is, en een rode stip bij Ondersteuning laat zien dat er iets nieuws is.

Wil je weten wat er nieuw is in {{appName}}? Kijk onder **Wat is er nieuw?** in het menu onder je naam.

## Veelgestelde vragen {#veelgestelde-vragen}

### Een onderdeel in de zijbalk is grijs.

Kies eerst een bedrijf. Tijdens het aanmaken van een bedrijf is de Atlas tijdelijk niet beschikbaar.

### Ik zie mijn gegevens niet, of andere dan verwacht.

Kijk of het juiste jaar is gekozen onder **Kalender**.

### Ik zie geen gebruiksruimte.

De gebruiksruimte is er voor 2025 en 2026. Kies een van die jaren.

### De balans zegt dat bodemgegevens ontbreken.

Voeg een bodemanalyse toe met totaal stikstof, bodemtype en organische stof.

### Het bemestingsadvies is niet beschikbaar.

Controleer of het perceel een gewas en een bodemanalyse heeft. Bij een tijdelijke storing: probeer het later opnieuw.

### Kloppen de bodemwaarden wel?

Staat er **Geschat met NMI BodemSchat**, dan is het een schatting. Upload je eigen labanalyses voor de beste resultaten.

### Klopt het gewas wel?

Bij import komt het hoofdgewas uit de BRP-registratie. Controleer het en pas het aan als dat nodig is.

### Een perceel ontbreekt in de balans of het advies.

Waarschijnlijk staat het als bufferstrook. Bufferstroken tellen bewust niet mee. Pas het aan onder **Gegevens** van het perceel als het geen bufferstrook is.

### De RVO-import lukt niet.

Controleer je KvK-nummer en je eHerkenning-machtiging, en ververs de pagina niet tijdens het importeren. Lukt het niet, gebruik dan de shapefile.

### Mijn PDF wordt niet goed uitgelezen.

Controleer of je lab in de lijst staat en vul de waarden anders handmatig in. Stuur het rapport gerust mee via Ondersteuning, dan kijken we ernaar.

### Ik zie Mineralisatie of Gerrit niet.

Labs-functies worden stap voor stap vrijgegeven.

## Voor technische gebruikers {#technisch}

{{appName}} is gebouwd op het open-source Farm Data Model van NMI ([nmi-agro/fdm](https://github.com/nmi-agro/fdm)). Ben je ontwikkelaar en wil je verwijzen naar een specifiek stuk code? Dan kun je ook een issue aanmaken in die repository. Voor alle andere vragen en meldingen is **Ondersteuning** de juiste plek.
