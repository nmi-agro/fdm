# Orchard fruit and small fruit (fruitteelt)

Omvat:

- **Pit- en steenvrucht**: appel (nl_212 generiek, nl_1095 geplant huidig seizoen,
  nl_1096 geplant vorig seizoen), peer (gedeeld onder nl_212), pruim (nl_1870), kers
  (nl_1872 zuur, nl_2328 zoet).
- **Kleinfruit / zachtfruit**: blauwe bes (nl_1869), zwarte bes (nl_1873), rode bes
  (nl_2325), framboos (nl_2326), kruisbes / overig kleinfruit (nl_1874).
- **Aardbei, vollegrond**: nl_2700 (vermeerdering), nl_2701 (wachtbed), nl_2702
  (productie), nl_2703 (zaaizaad / vermeerdering).
- **Aardbei op stellingen**: nl_2704–nl_2707 (zelfde rolverdeling).

Fruitteelt is een meerjarige sector met sterk **bladanalysegestuurde** bemesting;
jaarlijkse bodemanalyse alleen is niet voldoende. Verwijs naar de relevante
sectorbemestingsrichtlijnen voor soort- en cultivarspecifieke giften; deze skill geeft
alleen de algemene bandbreedte.

> **Aardbei is botanisch kleinfruit maar agronomisch nauwer verwant aan vollegrondsgroenten**
> — zie de aardbeiensectie hieronder.

## Pit- en steenvrucht — appel, peer, pruim, kers (nl_212, nl_1095, nl_1096, nl_1870, nl_1872, nl_2328)

**Voorkeur:**

- **Bladanalysegestuurde** N, P, K, Mg, Ca, B, Mn, Zn — vraag de jaarlijkse bladanalyse
  op bij de teler en combineer die met `advice.d_*_req`.
- Gedeelde N-gift: kleine vroege voorjaarsgift (knopzwelling / muizenoorstadium) plus
  een tweede gift na de bloei. Een bladtoepassing met ureum in de herfst rond bladval,
  na de oogst, voor vorming van bladreserves is gebruikelijk in appel — dit is een
  bladtoepassing, geen bodemtoepassing.
- K als K₂SO₄ / patentkali — KCl is ongebruikelijk in fruit: appel is matig
  Cl-gevoelig, en patentkali levert ook de Mg die appel structureel nodig heeft.
- Magnesium volgens `advice.d_mg_req` — appel heeft een sterke Mg-behoefte
  (Mg-gebrek veroorzaakt bladverbruining en voortijdige vruchtval).
- Borium volgens `advice.d_b_req` — vooral peer en pruim zijn B-gevoelig (slechte
  vruchtzetting).
- Calcium voor appel: bitter pit in Elstar, Jonagold etc. is een klassiek
  Ca-translocatieprobleem. Bodem-Ca alleen is niet voldoende — herhaalde
  Ca-bladbespuitingen vanaf vruchtzetting tot kort vóór pluk zijn standaardpraktijk.
  `advice.d_ca_req` dekt het bodemdeel, niet de bladbespuitingen.

**Vermijden:**

- Hoge N in jonge aanplant (nl_1095, nl_1096): geeft te sterke groei ten koste van
  vroege productie en wortelontwikkeling. `advice.d_n_req` houdt rekening met leeftijd.
- N-toepassingen na half juli in appel: verminderen vruchtkleur en bewaarbaarheid
  (Jonagold, Elstar, Kanzi); bij peer (Conference) verkort het de bewaarbaarheid.
- KCl in volwassen aanplant — Cl-belasting in fruit en blad.
- Verse drijfmest direct rond de stam — wortelschade en zoutstress.

**Extra aandacht:**

- In moderne boomgaarden wordt bemesting vaak toegediend via **fertigatie / druppel**; de
  giften uit `advice.d_*_req` blijven gelden, alleen de toedieningsroute verschilt.
- Hagelnetten / regenkappen in moderne pit- en steenvrucht beïnvloeden N-mineralisatie
  (lagere bodemtemperatuur); wees bij twijfel iets voorzichtiger met vroege N.
- Voor jonge aanplant (nl_1095, nl_1096) zijn structuur en bodemvocht belangrijker dan
  bemesting — markeer dit als de teler een nieuw aangeplante boomgaard opvoert.

## Kleinfruit — bessen, framboos, kruisbes (nl_1869, nl_1873, nl_2325, nl_2326, nl_1874)

**Voorkeur:**

- **Blauwe bes (nl_1869)** vraagt een **zure grond** (pH-KCl 4.0–5.0). **Geen
  bekalking** in blauwe-bessenaanplant; in plaats daarvan is verzuring met elementaire S
  of zure organische stof (veen, naaldhoutcompost) standaard. `advice.d_ca_req > 0` bij
  blauwe bes is een signaal dat het perceel ongeschikt is en als waarschuwing in het plan
  moet verschijnen.
- Zwarte / rode bessen, kruisbessen: pH-KCl 5.5–6.0 op zand, hoger op klei; volg
  `advice.d_ca_req`.
- Gedeelde N met basisgift in het voorjaar en een kleine bijbemesting na de bloei; geen N
  na half juli.
- K als K₂SO₄ — alle kleinfruit is Cl-gevoelig.
- Borium en Mg volgens `advice.d_b_req` / `advice.d_mg_req`.

**Vermijden:**

- KCl op kleinfruit — bladrandverbranding en verminderde houdbaarheid.
- Bekalking in blauwe-bessenaanplant — vernietigt het volledige teeltsysteem.
- Verse drijfmest tussen de struiken — wortelschade en ziekterisico.

## Aardbei (nl_2700–nl_2707)

Aardbei is **kort-meerjarig** (1–2 productiejaren) en agronomisch het meest verwant aan
vollegrondsgroenten.

**Voorkeur:**

- Basisgift NPK vóór planten (juli–augustus voor doordragers / wachtbedplanten;
  augustus–september voor junidragers); voorjaarsbijbemesting voor het productieperceel.
- Fertigatie waar beschikbaar — aardbei is een klassiek fertigatiegewas op stellingen en
  rugteeltsystemen.
- K als K₂SO₄ — aardbei is Cl-gevoelig (vruchtkwaliteit, smaak, houdbaarheid).
- Borium en Ca volgens `advice.d_b_req` / `advice.d_ca_req` — Ca tegen bladrandsymptomen
  en zacht fruit.

**Vermijden:**

- Hoge N tijdens vruchtzetting en oogst — zacht fruit, _Botrytis_, smaakverlies.
- Verse drijfmest in productiepercelen — risico op _Phytophthora_ en _Botrytis_, en
  aandachtspunten rond voedselveiligheid.
- KCl in productiepercelen.

**Teelt op stellingen (nl_2704–nl_2707)**: bemesting via voedingsoplossing en
fertigatie; deze skill dekt alleen de algemene bandbreedte. Verwijs naar de specifieke
voedingsschema's van de teler of vermeerderaar.

**Vermeerdering en wachtbedden (nl_2700, nl_2701, nl_2704, nl_2705)** vragen minder N
dan productie (beheerste groei, geen vruchtvorming gewenst); `advice.d_n_req` houdt
rekening met dit stadium.

**Extra aandacht (alle fruitsoorten):**

- Zowel bodem- als bladanalyse zijn nodig; bodemanalyse alleen overschat of onderschat de
  werkelijke aanvoer in een meerjarige aanplant.
- Rest-N uit een gerooid oud perceel of uit een grasstrook tussen de rijen is aanzienlijk;
  neem dit mee in het volgende jaar via de standaard fdm-calculator-workflow, niet hier.
