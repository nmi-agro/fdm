---
title: "Labs: Mineralisatie"
description: Probeer nieuwe functies die nog in ontwikkeling zijn, zoals het verloop van de stikstof in je bodem en gewas door het seizoen heen.
section: Resultaten
order: 7
inApp:
  - Labs
  - Mineralisatie
routes:
  - farm.$b_id_farm.$calendar.mineralization*
watch:
  - fdm-app/app/components/blocks/mineralization/**
keywords:
  - mineralisatie
  - stikstoflevering
  - Dyna
related:
  - background/mineralisatie
  - gerrit
---

Onder **Labs** in de zijbalk vind je nieuwe functies die nog in ontwikkeling zijn. Ze werken al, maar kunnen nog veranderen. Ze worden stap voor stap vrijgegeven, dus het kan zijn dat je ze nog niet ziet. Ook [Gerrit, de AI-bemestingsassistent](/manual/gerrit) staat onder **Labs**; die heeft een eigen hoofdstuk.

## Mineralisatie {#mineralisatie}

**Mineralisatie** laat zien hoeveel stikstof er in de loop van het seizoen vrijkomt uit je bodem, je bemestingen, gewasresten en groenbemesters, hoeveel het gewas daarvan opneemt en hoeveel er uitspoelt. Het rekent dag voor dag met het Dyna-model van NMI, op basis van het gemeten weer tot vandaag, de weersverwachting en langjarige klimaatgegevens daarna.

- Voor het bedrijf zie je per perceel de **Beschikbare N nu**, de verwachte opname en de verwachte uitspoeling, plus **Signalen** voor percelen die aandacht vragen, zoals een verwacht tekort of veel regen rond een geplande bemesting.
- Klik op een perceel voor het verloop over het jaar: het **N-aanbod**, de **N-opname gewas** en de **Uitspoeling**, met de **Gebeurtenissen op het perceel** zoals bemestingen en de oogst. Het deel na vandaag is een verwachting.
- Dyna heeft een oogst van het hoofdgewas nodig, gemeten of gepland. Zie je **Oogst ontbreekt**, vul dan de oogst aan via **Oogst aanpassen**.
- Je kunt een bemesting in een scenario verschuiven en zien wat dat doet met de beschikbare stikstof en de uitspoeling.

Wat mineralisatie is en hoe Dyna rekent, lees je in [Mineralisatie](/manual/background/mineralisatie#dyna).
