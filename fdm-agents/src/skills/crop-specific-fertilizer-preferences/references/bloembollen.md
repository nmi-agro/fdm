# Flower bulbs (bloembollen) — nl_176 + species-specific codes

Dekt:

- Generieke / overige bollen: nl_176, nl_1006 (overig), nl_997 (dahlia), nl_1000 (iris),
  nl_1005 (zantedeschia), nl_1007 (amaryllis), nl_1012 (sierui), nl_1015
  (blauwe druif), nl_1018 (kuifhyacint), nl_1027 (pioen), nl_6795 (liatris),
  nl_6803 (sneeuwklokje).
- **Tulp** (nl_985, nl_986, nl_1004), **lelie** (nl_979, nl_980, nl_1002),
  **narcis** (nl_982, nl_983, nl_1003), **hyacint** (nl_970, nl_971, nl_999),
  **krokus** (nl_976, nl_977, nl_1001), **gladiool** (nl_967, nl_968, nl_998),
  **kuifhyacint** (nl_1016, nl_1017).

Bloembollenteelt is een niche- en contractgestuurde sector met zeer specifiek
bemestingsadvies dat sterk varieert per soort en grondsoort. Deze skill geeft alleen de
overkoepelende regels; verwijs naar de specifieke sectoradviesdocumenten voor soort- en
grondsoortspecifieke giften, en laat `advice.d_*_req` de giftbeslissingen dragen.

## Overkoepelende regels (gelden voor alle bolgewassen in NL)

**Vermijden:**

- **Chloride is het primaire risico**. Bollen — vooral lelie en hyacint — zijn sterk
  Cl-gevoelig: KCl, kalksalpeter (CaCl₂-verontreiniging in sommige kwaliteiten),
  hoogovenslakkenmeel met hoog Cl-gehalte en drijfmest met hoog Cl-gehalte veroorzaken
  blad­randschade, slechte beworteling en groeistoornissen. **Gebruik altijd K₂SO₄ /
  patentkali als K-bron**, en controleer vóór gebruik het Cl-gehalte van elke samengestelde
  meststof of organische input.
- Overmaat N: bollen zijn zeer N-efficiënt en overbemesting geeft los geschubde tulpen,
  ziektegevoelige hyacinten en zwakke lelies. Blijf strikt binnen `advice.d_n_req`.
- Late N kort voor bladveroudering: verhoogt de ziektegevoeligheid en blokkeert de
  natuurlijke verplaatsing van reserves naar de bol.

**Voorkeur:**

- Gedeelde N-gift: de meeste bollen hebben een vroege N-gift rond opkomst nodig en een
  tweede gift rond bloei. Een verdeling van ongeveer half-om-half is een gebruikelijk
  startpunt; soortspecifieke schema's uit sectoradvies gaan hier boven.
- Zwavel volgens `advice.d_s_req` — bolgewassen op de typische duinzand- en zavelgronden
  vertonen vaak S-gebrek.
- Borium volgens `advice.d_b_req` — vooral lelie en gladiool zijn B-gevoelig.
- Mangaan en zink volgens `advice.d_mn_req` / `advice.d_zn_req` — tulp en hyacint op
  kalkrijke gronden vertonen vaak Mn-gebrek.
- Goed uitgerijpte, Cl-arme organische stof (compost, goed verteerde stalmest) toegediend
  in het voorafgaande seizoen, niet vlak vóór planten.

**Per soort — punten om te markeren:**

- **Lelie (nl_979, nl_980, nl_1002)**: extreem Cl-gevoelig; gebruik nooit KCl; beperk ook
  drijfmest vanwege Cl- en zoutgehalte. Patentkali / K₂SO₄ + ammoniumsulfaat als basis.
- **Hyacint (nl_970, nl_971, nl_999, nl_1018)**: sterk Cl-gevoelig; Mn op kalkrijke
  gronden via `advice.d_mn_req`.
- **Tulp (nl_985, nl_986, nl_1004)**: matig Cl-gevoelig; N-beheer stuurt rooikwaliteit
  en huidkwaliteit van de bol.
- **Narcis (nl_982, nl_983, nl_1003)**: relatief robuust, maar Cl wordt bij voorkeur
  vermeden; voorzichtig bekalken — narcis verdraagt na een lange teelthistorie geen hoge
  pH.
- **Krokus (nl_976, nl_977, nl_1001)**, **gladiool (nl_967, nl_968, nl_998)**:
  gevoelig voor zoutbelasting; gladiool heeft B nodig.
- **Dahlia (nl_997), zantedeschia (nl_1005), amaryllis (nl_1007), liatris, pioen
  (nl_1027)** etc.: sterk gespecialiseerd; vertrouw op `advice.d_*_req` en sectoradvies.

**Extra aandacht:**

- Vruchtwisseling en _Pratylenchus_ / aaltjesbeheer sturen de meststofkeuze deels
  (keuze van groenbemester; vermijd nabijheid van Tagetes / peen; etc.); markeer dit
  alleen als de teler ernaar vraagt — het is geen bemestingsbeslissing.
- Bollenpercelen liggen vaak op kalkrijke duinzandgronden of klei; de pH is meestal al
  hoog (pH-KCl > 7) en bekalking is zelden nodig — verifieer dit altijd vóór het
  aanbevelen van kalk.
- Verwijs naar de relevante sectorbemestingsrichtlijnen voor soort- en
  grondsoortspecifieke N / P / K / S / Mg / B / Mn-giften; deze skill geeft alleen de
  kwalitatieve bandbreedte.
