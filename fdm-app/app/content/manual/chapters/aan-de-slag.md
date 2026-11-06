---
title: Aan de slag
description: Aanmelden met Microsoft, Google of e-mail, je profiel invullen en je eerste bedrijf aanmaken of een uitnodiging accepteren.
section: Aan de slag
order: 2
routes:
  - signin._index.tsx
  - signin.check-your-email.tsx
  - signin.verify.tsx
  - welcome.tsx
  - farm._index.tsx
watch:
  - fdm-app/app/components/blocks/signin/**
  - fdm-app/app/components/blocks/auth/**
keywords:
  - inloggen
  - aanmelden
  - account aanmaken
  - uitnodiging
related:
  - zo-werkt-het
  - bedrijf-aanmaken
---

Inloggen kan met je Microsoft- of Google-account, of met een code die je per e-mail krijgt. Een wachtwoord heb je dus niet nodig. Een account maak je niet apart aan: de eerste keer dat je je aanmeldt, wordt het voor je aangemaakt.

## Aanmelden {#aanmelden}

1. Ga naar [{{appUrl}}]({{appUrl}}).
2. Kies **Aanmelden met Microsoft** of **Aanmelden met Google**. Liever via e-mail? Vul dan je **E-mailadres** in en klik op **Aanmelden met e-mail**.
3. Bij e-mail krijg je een bericht met een link en een code van 6 cijfers. Klik op de link, of typ de code in onder **Of vul de code in**. Code en link werken 15 minuten en maar één keer.
4. Geen mail gekregen? Kijk even in je spam, klik op **Geen code ontvangen? Opnieuw versturen** of kies **Ander e-mailadres gebruiken**.

Uitloggen doe je via je naam onderaan de zijbalk en dan **Uitloggen**.

## Je profiel invullen {#profiel}

De eerste keer vraagt {{appName}} om je **Voornaam** en **Achternaam**. Een foto toevoegen mag, maar hoeft niet. Log je in met Google of Microsoft, dan stelt de app je profielfoto van dat account voor. Klik op **Doorgaan** en je bent binnen.

## Je eerste bedrijf {#eerste-bedrijf}

Na het inloggen kom je op **Mijn bedrijven**. Wat je daar ziet, hangt af van je situatie:

- Nog geen bedrijven? Klik op **Bedrijf aanmaken**. In [Een bedrijf aanmaken](/manual/bedrijf-aanmaken) lees je hoe dat gaat.
- Ben je uitgenodigd? Dan staat de uitnodiging onder **Openstaande uitnodigingen**. Klik op **Accepteren** en het bedrijf verschijnt in je lijst.
- Heb je al bedrijven? Elk bedrijf staat op een kaart met je rol erbij: **Eigenaar**, **Adviseur** of **Onderzoeker**. Bedrijven waar je via een organisatie bij kunt, staan apart onder **Bedrijven van uw organisaties**.

Onderaan de pagina staan ook snelkoppelingen naar de Atlas-kaarten (Percelen, Hoogtekaart, Bodemkaart). Die kun je ook zonder eigen bedrijf gebruiken.

## Je bedrijf inrichten {#inrichten}

Dit is de snelste route naar een compleet bedrijf:

1. [Maak een bedrijf aan](/manual/bedrijf-aanmaken#stappen) met je bedrijfsnaam en, als je die hebt, je KvK-nummer.
2. Haal je percelen binnen. Kies de manier die bij je past: [ophalen bij RVO met eHerkenning](/manual/bedrijf-aanmaken#rvo), [een shapefile uit mijn.rvo.nl uploaden](/manual/bedrijf-aanmaken#shapefile) of [aanklikken op de kaart](/manual/bedrijf-aanmaken#kaart).
3. Controleer per perceel de naam, het hoofdgewas en of het een bufferstrook is.
4. [Upload je labrapporten in één keer](/manual/bodem#bodemanalyses-uploaden). {{appName}} koppelt ze zelf aan de juiste percelen.
5. Vul in het [bouwplan](/manual/bouwplan) zaaidata, oogsten en bemestingen in. Bij elke bemesting zie je [direct wat die doet](/manual/bemesting#effect) voor je gebruiksruimte, het bemestingsadvies en de stikstofbalans.
6. Bekijk de [balansen](/manual/balansen), de [gebruiksruimte](/manual/gebruiksruimte) en het [bemestingsadvies](/manual/bemestingsadvies).
