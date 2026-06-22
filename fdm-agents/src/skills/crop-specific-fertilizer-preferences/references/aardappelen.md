# Aardappelen (aardappelen)

De bemestingsstrategie voor aardappelen verschilt fundamenteel per marktsegment. Bepaal het segment
op basis van de gewascataloguscode en pas de bijbehorende regels hieronder toe.

## Zetmeelaardappelen (zetmeelaardappelen) — nl_2017, nl_3732, nl_859

Vooral geteeld in de Veenkoloniën / Noordoost-Nederland voor de zetmeelindustrie. De kwaliteit wordt
bepaald via **onderwatergewicht (OWG)** — de belangrijkste uitbetalingsparameter.

**Vermijden:**
- Chloridehoudende meststoffen (KCl / kali-60): **absoluut verboden**. Zelfs matige hoeveelheden Cl
  verlagen het OWG en daarmee de zetmeelopbrengst. Gebruik alleen K₂SO₄ (zwavelzure kali) of patentkali als K-bron.
- Extra N boven `advice.d_n_req`: zetmeel is gevoelig voor overbemesting — te veel N
  vertraagt de afsterving en verlaagt het OWG. Het N-advies voor zetmeel is doorgaans matig; volg dit
  nauwkeurig.

**Voorkeur:**
- Patentkali (K₂SO₄·MgSO₄) als belangrijkste K-bron — levert tegelijk Mg en S, beide
  belangrijk op de doorgaans Mg-arme zandgronden in de Veenkoloniën.
- Gesplitste N-gift: ~60 % bij het poten, ~40 % als bijbemesting bij knolzetting.
- Vroege P-toediening (starter of vóór het poten) — zetmeelaardappelen op de P-arme zandgronden
  van de Veenkoloniën reageren in koude voorjaren sterk op P.
- Organische mest (rundveedrijfmest, varkensdrijfmest) toedienen vóór het ruggen maken — beperk de dosering om
  te veel N bij opkomst te voorkomen.

**Extra aandacht:**
- Magnesium: zetmeelaardappelen zijn zeer gevoelig voor Mg-gebrek op zure zandgronden.
  Controleer de Mg-aanvoer uit patentkali of kieseriet als de Mg-toestand van de bodem laag is.
- Mangaan: veelvoorkomend gebrek op dalgronden in de regio. Controleer
  `advice.d_mn_req`; bladbespuiting met Mn wanneer symptomen optreden.
- Borium: nodig voor de schilkwaliteit van de knol; neem B op wanneer `advice.d_b_req > 0`.

## Fritesaardappelen (verwerking / frites) — nl_2014, nl_1909, nl_1910, nl_2951, nl_3792

> **Opmerking**: de cataloguscodes nl_2014, nl_1909, nl_1910, nl_2951, nl_3792 zijn generieke
> "consumptie"-codes die zowel frites- als tafelbestemmingen omvatten. De segmentspecifieke
> regels hieronder gelden wanneer het perceel is gecontracteerd voor **frites**. Wanneer de bestemming
> niet bekend is, gebruik dan `consumptieaardappelen.md` en vraag de teler.

Geteeld voor de fritesindustrie (bijv. Aviko, LambWeston, Farm Frites). De kwaliteit wordt beoordeeld op
**bakkleur** en **drogestof** (streefwaarde 19–24 %).

**Vermijden:**
- KCl (kali-60): chloride verhoogt het gehalte aan reducerende suikers → donkere bakkleur (Maillardreactie).
  Gebruik voor verwerkingsaardappelen altijd K₂SO₄ of patentkali.
- Late N-giften (na eind juli): vertragen de afrijping, verhogen reducerende suikers en
  verlagen drogestof.

**Voorkeur:**
- Gesplitste N-gift: ~50 % vóór het poten, ~25 % bij knolzetting, ~25 % tijdens knolgroei. De totale N volgt
  `advice.d_n_req`.
- Patentkali voor de aanvoer van K + Mg + S.

**Extra aandacht:**
- Calcium: inwendig bruin is deels Ca-gerelateerd. Stuur via Ca-beschikbaarheid vroeg in het seizoen
  wanneer `advice.d_ca_req > 0` (vroege bekalking of gips), niet via N-houdende Ca-producten laat in het seizoen.
  De veldreactie op Ca-bemesting is wisselend en wordt grotendeels bepaald door beregening en raskeuze.
- Drogestof moet binnen de contractband blijven (doorgaans 19–24 %). Te veel N verlaagt drogestof.
- Borium: neem B op wanneer `advice.d_b_req > 0`.

## Tafelaardappelen (versmarkt / tafelaardappelen) — nl_1911, nl_1912

> **Opmerking**: nl_1911 en nl_1912 zijn codes voor "vroege consumptie" (loofvernietiging vóór 15-07).
> Het vroege/primeurregime staat in `vroegeaardappelen.md`. De algemene tafelregels
> hieronder gelden voor tafelaardappelen ongeacht de code; gebruik ze in combinatie met de
> vroege richtlijnen voor deze specifieke codes.

De kwaliteit wordt beoordeeld op uiterlijk (gladde schil, geen schurft) en smaak (drogestof, kookkwaliteit).

**Vermijden:**
- Bekalking op zandgronden bestemd voor tafelaardappelen: een lage pH onderdrukt gewone schurft
  (schurft). Op zand neemt het schurftrisico toe zodra pH-KCl boven het schurftonderdrukkende
  bereik komt (ruwweg boven ~5.2). Signaleer dit risico in het plan en bekalk alleen via `advice.d_ca_req`
  wanneer de rotatie als geheel dat vraagt.
- Extra N boven `advice.d_n_req`: geeft grote, waterige knollen met minder smaak en lagere
  drogestof. Het N-advies voor tafelaardappelen is doorgaans matig.

**Voorkeur:**
- Volg `advice.d_n_req` met gesplitste giften.
- K₂SO₄ heeft de voorkeur boven KCl voor de algemene knolkwaliteit, al is de Cl-gevoeligheid lager dan bij
  frites/zetmeel.
- Borium voor schilkwaliteit; controleer `advice.d_b_req`.

## Pootaardappelen (pootaardappelen) — nl_2015, nl_2016, nl_1928, nl_1929, nl_3730, nl_3731

Geteeld voor NAK-gecertificeerd pootgoed. Doel is een uniforme sortering van kleine tot middelgrote knollen (28–55 mm sortering).

**Vermijden:**
- Te veel N: pootaardappelen hebben het laagste N-advies van alle aardappeltypen. Te grote knollen worden
  afgekeurd of lager gewaardeerd. Te veel N vertraagt ook het moment van loofvernietiging. Volg
  `advice.d_n_req` strikt — overschrijd het niet.
- Late N: pootgoedtelers vernietigen het loof vroeg (juni–juli) om virusverspreiding te voorkomen. Elke late N-gift
  is verspild.
- KCl: pootaardappelcontracten vragen steeds vaker kwaliteitsparameters die Cl-gevoelig zijn.

**Voorkeur:**
- N vroeg in het seizoen: ~70 % bij het poten, maximaal ~30 % als bijbemesting kort na opkomst.
- K₂SO₄ of patentkali.
- Mangaan: belangrijk op kalkrijke gronden/gronden met hoge pH (Flevoland, Noordoostpolder — belangrijke
  pootaardappelregio's). Neem blad-Mn op wanneer `advice.d_mn_req > 0`.

## Alle aardappeltypen — algemene aandachtspunten

- **Magnesium**: alle aardappeltypen zijn Mg-gevoelig. Controleer Mg uit patentkali/kieseriet als
  de Mg-toestand van de bodem laag is.
- **Borium**: nodig voor knolschilkwaliteit bij alle typen. Neem een B-bron op wanneer
  `advice.d_b_req > 0`.
- **Organische mest**: toepassen vóór het ruggen maken; beperk de dosering om vroege N te beheersen.
  Geef de voorkeur aan rundveedrijfmest vanwege een betere N/K-verhouding dan varkensdrijfmest.
- **Ammonium-N vroeg**: geef op zandgronden vroeg in het seizoen de voorkeur aan NH₄⁺-vorm (KAS/CAN in plaats van
  puur nitraat) om het uitspoelingsrisico te beperken.
