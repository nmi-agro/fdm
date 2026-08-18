# Grasland (productiegrasland) — nl_265, nl_266

**Voorkeur:**

- Rundveedrijfmest als belangrijkste mestproduct — past bij het typische melkveebedrijfssysteem en
  heeft een gunstige N/P-verhouding voor grasland.
- Meerdere N-giften afgestemd op groeisneden: meestal 4–6 giften verdeeld over
  maai-/beweidingscycli van februari tot augustus.
- KCl (kali-60) is acceptabel voor **maaigrasland** (maaien) — chloridegevoeligheid is geen
  aandachtspunt voor gras.
- Zwavel: grasland reageert vaak op S, vooral in de eerste snede. Neem S op als
  `advice.d_s_req > 0`.
- Bekalking (bekalken): gras en gras/klavermengsels zijn pH-gevoelig (klaver houdt minder stand
  bij lage pH). Behandel een lage pH-KCl als risicosignaal en raadpleeg `advice.d_ca_req` en bodem-
  pH-gegevens voordat bekalking wordt geadviseerd.

**Snedezwaarte (`yieldclass`)**

Wanneer per-snede advies (`advice.cuts`) beschikbaar is, betekent de `yieldclass`:

| Code | Betekenis | Droge-stofopbrengst |
| --- | --- | --- |
| `VLG` | Zeer lichte beweiding | `<= 1.000 kg DS/ha` |
| `LG` | Lichte beweiding | `> 1.000` en `< 1.500 kg DS/ha` |
| `G` | Normale beweiding | `>= 1.500` en `< 2.000 kg DS/ha` |
| `LM` | Licht maaien | `>= 2.000` en `< 2.500 kg DS/ha` |
| `M` | Normaal maaien | `>= 2.500` en `<= 3.000 kg DS/ha` |
| `HM` | Zwaar maaien | `> 3.000 kg DS/ha` |

Gebruik deze indeling alleen om een geregistreerde droge-stofopbrengst te duiden wanneer die
informatie beschikbaar is. Het per-snede advies uit `fdm-calculator` blijft leidend; leid geen
droge-stofopbrengst af uit de code alleen en verzin geen ontbrekende sneden.

**Vermijden:**

- Varkensdrijfmest in hoge eenmalige giften op grasland — het hoge P-gehalte geeft risico op P-afspoeling op
  verzadigde bodems en kan de bedrijfs-P-balans boven wettelijke grenzen brengen.
- N in nazomer / herfst: respecteer de wettelijke sluitingsdata voor kunstmest-N en drijfmest op
  grasland zoals vastgesteld door RVO (sluitingsdata verschillen per product, grondsoort en jaar — controleer de
  actuele data in plaats van ze aan te nemen). Late N geeft ook risico op luxe N-opname zonder afvoer van biomassa
  en verhoogde nitraatuitspoeling in de herfst.

**Extra aandacht — weidegrasland (begrazing):**

- **Kopziekte (grastetanie / hypomagnesiëmie)**: vermijd op weidegrasland dat in het voorjaar door melkvee wordt beweid
  hoge K-giften in de eerste weidesnede. Veel K in gras remt de Mg-opname
  door runderen (K/Mg-antagonisme), waardoor het risico op kopziekte toeneemt. Dien K-rijke
  meststoffen (inclusief KCl) bij voorkeur toe na de eerste beweidingsronde, of op percelen die alleen worden gemaaid.
  Zorg voor voldoende Mg in het bemestingsplan (kieseriet, MgO) wanneer K-niveaus hoog zijn.
- Selenium (Se) en Cobalt (Co): geen onderdeel van het standaard CBGV-bemestingsadvies voor grasland in
  NL — meestal geregeld via aanvulling in het veevoer. Noem dit alleen als optie aan de meststofkant
  als de veehouder dit punt expliciet aanhaalt.
