# Consumptieaardappelen — generieke codes (nl_2014, nl_1909, nl_1910, nl_2951, nl_3792)

Deze BRP-codes omvatten **consumptieaardappelen** zonder onderscheid naar eindmarkt.
In de Nederlandse praktijk kan het perceel gecontracteerd zijn voor **verwerking** (frites,
chips) of voor de **versmarkt** (tafel), en het bemestingsregime verschilt tussen die twee.

## Eerste stap: bepaal de bestemming

Vraag vóór toepassing van segmentspecifieke regels aan de teler (of zoek het contract op) voor welke
markt het perceel wordt geteeld:

- **Verwerking / frites** — pas de regels in `aardappelen.md` → "Fritesaardappelen" toe.
- **Versmarkt / tafel** — pas de regels in `aardappelen.md` → "Tafelaardappelen" toe.

Signaleer deze verduidelijking in de samenvatting van het plan.

## Wanneer de bestemming niet bekend is — conservatieve gedeelde regels

Als de bestemming vóór de planning niet kan worden vastgesteld, val dan terug op de regels hieronder.
Deze zijn conservatief en werken voor beide segmenten zonder een van beide te schaden; signaleer de
onduidelijke bestemming aan de teler.

**Vermijden:**
- KCl (kali-60): zowel verwerkings- als tafelaardappelen profiteren van K in sulfaatvorm.
  Gebruik K₂SO₄ of patentkali.
- Late N (na eind juli): ongunstig voor beide segmenten — verwerkingsaardappelen verliezen drogestof
  en bakkleur; tafelaardappelen worden waterig en verliezen drogestof en kookkwaliteit.
- N-giften boven `advice.d_n_req`.

**Voorkeur:**
- Gesplitste N-gift met nadruk aan het begin: ongeveer de helft vóór het poten, een kwart bij knolaanleg en een
  kwart tijdens knolgroei. De totale N volgt `advice.d_n_req`.
- Patentkali voor gecombineerde aanvoer van K + Mg + S.
- Borium wanneer `advice.d_b_req > 0` (schilkwaliteit is in beide segmenten belangrijk).
- Magnesium wanneer de Mg-toestand van de bodem laag is (kieseriet of patentkali).

**Extra aandacht:**
- Het drogestofgehalte is in beide segmenten belangrijk (typische contractband 19–24 % voor
  verwerking; bij de versmarkt bepaalt het mede de kookkwaliteit). Te veel N verlaagt drogestof.
- pH-risico voor gewone schurft op zand bij versmarktbestemmingen — zie de schurftopmerking in
  `aardappelen.md`.
- Algemene aardappelnotities (Mg, B, timing van mest, ammonium-N vroeg op zand) in
  `aardappelen.md` gelden voor alle consumptieaardappelen.
