---
title: "Labs: Mineralisatie en Gerrit"
description: Probeer nieuwe functies die nog in ontwikkeling zijn, zoals het stikstofverloop op je percelen en Gerrit, de AI-bemestingsassistent.
section: Resultaten
order: 6
inApp:
  - Labs
  - Mineralisatie
routes:
  - farm.$b_id_farm.$calendar.mineralization*
  - farm.$b_id_farm.$calendar.gerrit.tsx
watch:
  - fdm-app/app/components/blocks/mineralization/**
  - fdm-app/app/components/blocks/gerrit/**
keywords:
  - mineralisatie
  - stikstoflevering
  - Dyna
  - Gerrit
  - AI bemestingsplan
related:
  - background/mineralisatie
  - bemestingsplan
---

Onder **Labs** in de zijbalk vind je nieuwe functies die nog in ontwikkeling zijn. Ze werken al, maar kunnen nog veranderen. Ze worden stap voor stap vrijgegeven, dus het kan zijn dat je ze nog niet ziet.

## Mineralisatie {#mineralisatie}

**Mineralisatie** laat zien hoeveel stikstof er in de loop van het seizoen vrijkomt uit je bodem, je bemestingen, gewasresten en groenbemesters, hoeveel het gewas daarvan opneemt en hoeveel er uitspoelt. Het rekent dag voor dag met het Dyna-model van NMI, op basis van het gemeten weer tot vandaag, de weersverwachting en langjarige klimaatgegevens daarna.

- Voor het bedrijf zie je per perceel de **Beschikbare N nu**, de verwachte opname en de verwachte uitspoeling, plus **Signalen** voor percelen die aandacht vragen, zoals een verwacht tekort of veel regen rond een geplande bemesting.
- Klik op een perceel voor het verloop over het jaar: het **N-aanbod**, de **N-opname gewas** en de **Uitspoeling**, met de **Gebeurtenissen op het perceel** zoals bemestingen en de oogst. Het deel na vandaag is een verwachting.
- Dyna heeft een oogst van het hoofdgewas nodig, gemeten of gepland. Zie je **Oogst ontbreekt**, vul dan de oogst aan via **Oogst aanpassen**.
- Je kunt een bemesting in een scenario verschuiven en zien wat dat doet met de beschikbare stikstof en de uitspoeling.

Wat mineralisatie is en hoe Dyna rekent, lees je in [Mineralisatie](/manual/background/mineralisatie#dyna).

## Gerrit, de AI-bemestingsassistent {#gerrit}

Gerrit stelt een bemestingsplan voor je hele bedrijf voor. Daarbij houdt Gerrit rekening met de gebruiksnormen, het bemestingsadvies, de stikstofbalans en jouw wensen. Gerrit werkt voor 2025 en 2026, en je kunt hem 3 keer per dag gebruiken.

1. Open **Gerrit** en stel je strategie in. Je kiest bijvoorbeeld voor **Biologisch bedrijf** (geen kunstmest), **Opvullen mestruimte**, **Ammoniakemissies verminderen**, **Inzetten op doelsturing** of **Bouwplanniveau** (dezelfde bemesting voor percelen met hetzelfde gewas).
2. Kies onder **Meststoffenselectie** welke meststoffen Gerrit mag gebruiken.
3. Schrijf eventueel wensen op, zoals "gebruik bij voorkeur eigen drijfmest op de huiskavel".
4. Klik op **Bemestingsplan genereren**. Soms stelt Gerrit eerst een paar vragen; je kunt die beantwoorden of overslaan.
5. Bekijk het voorstel. Per perceel zie je de voorgestelde bemestingen, en wat dat betekent voor de normen, de stikstofbalans en het advies. Gerrit legt ook uit waarom hij voor deze aanpak kiest.
6. Tevreden? Klik op **Plan definitief maken en toepassen**.

> Let op: als je het plan toepast, vervangt Gerrit alle bemestingen van dat jaar op alle percelen van het bedrijf door zijn voorstel. Heb je al bemestingen ingevoerd die je wilt houden, controleer het voorstel dan extra goed.

Gerrit is een AI-systeem. De normen en adviezen in zijn voorstel worden met dezelfde vaste rekenregels berekend als in de rest van {{appName}}, maar de keuzes zijn een voorstel. Laat het plan altijd controleren door de teler of adviseur voordat je het toepast. Onder **Uitleg** op de pagina lees je hoe Gerrit werkt.
