# Extensief grasland met landbouwkundig gebruik — nl_331

nl_331 is "natuurlijk grasland mét landbouwactiviteiten": semi-natuurlijk grasland dat nog
wordt beheerd als landbouwgrond (maaien, soms lichte beweiding), maar met beperkte aanvoer,
vaak binnen een agrarisch natuurbeheerpakket (ANLb, beheersovereenkomst of SNL-pakket).

**Pas geen regels voor intensief grasland toe.** De aanvoer wordt bewust beperkt om
botanische diversiteit, leefgebied voor weidevogels of doelen voor grondwater en CO₂ in
veengebieden te behouden.

## Regels

**Voorkeur:**
- Controleer eerst de beheerovereenkomst (beheerpakket / ANLb-overeenkomst) voor het perceel —
  veel pakketten hebben expliciete bemestingsbeperkingen (bijv. "geen kunstmest",
  "vaste stalmest twee keer per jaar", rustperiodedata). Respecteer deze grenzen voordat
  agronomische logica wordt toegepast.
- Waar aanvoer is toegestaan, is **rundveedrijfmest in lage giften** of **vaste stalmest
  (ruige stalmest)** de gebruikelijke input. Pas dit alleen toe als het pakket dit toestaat en
  het perceelspecifieke `advice.d_n_req` dit ondersteunt.

**Vermijden:**
- Minerale N (kunstmest) — doorgaans niet toegestaan binnen botanische of weidevogelbeheer-
  pakketten, en niet passend bij het extensieve beheerdoel, zelfs waar dit niet expliciet
  verboden is.
- Meerdere gedeelde giften gedurende het seizoen.
- Late N — RVO-sluitingsdata gelden net als voor productiegrasland; veel beheerpakketten
  voegen eerdere rustperioden toe.
- Bekalking, tenzij deze expliciet wordt ondersteund door `advice.d_ca_req` en niet wordt
  geblokkeerd door het beheerpakket. Veel semi-natuurlijke grassoorten zijn afhankelijk van
  een lagere pH; overbekalking schaadt de diversiteit.

**Extra aandacht:**
- Als `advice.d_n_req = 0` of er geen advies wordt teruggegeven, ga dan uit van nulbemesting.
- Onderscheid dit van nl_332 ("hoofdfunctie natuur"), waar strengere of nul-aanvoer geldt (zie
  `natuurgrasland.md`), en van nl_265 / nl_266 (productiegrasland).
- Noteer in het plan dat het advies wordt begrensd door het extensieve beheerdoel en de
  beheerovereenkomst, niet alleen door agronomisch potentieel.
