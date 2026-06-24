# Peulvruchten (vlinderbloemigen) — nl_239, nl_241, nl_244, nl_308, nl_2650, nl_242, nl_243, nl_311, nl_665, nl_853, nl_854, nl_2779, nl_7121

Peulvruchten in dit bestand omvatten meerdere geslachten met verschillende sterkte van
N₂-binding en daarom verschillende N-strategieën. Kies de subsectie die past bij de
cataloguscode van het perceel; alleen de algemene regels gelden onvoorwaardelijk.

## Algemene regels

**Voorkeur:**
- Fosfaat- en kaliumvoorziening is voor deze gewassen vaak belangrijker dan N. Zorg dat het P-
  en K-advies wordt ingevuld (`advice.d_p_req`, `advice.d_k_req`).
- Molybdeen (Mo): essentiële cofactor voor nitrogenase; raadpleeg `advice.d_mo_req` (Mo is
  slecht beschikbaar op zure gronden).

**Vermijden:**
- Drijfmest bij het zaaien — risico op oppervlakkige verdichting en verminderde opkomst.

**Extra aandacht:**
- N-nalevering (resterende N): peulvruchten laten aanzienlijke resterende N achter voor het
  volggewas. Noteer dit in het plan voor N-planning op rotatieniveau, vooral voor Vicia en
  Pisum.

## Pisum sativum — erwten, kapucijners, schokkers — nl_239, nl_241, nl_244, nl_308, nl_2650

Sterke N₂-binding via *Rhizobium leguminosarum*. De natuurlijke populatie in Nederlandse
bodems is doorgaans voldoende; in standaardrotaties is geen inoculatie nodig.

**Voorkeur:**
- Minimale minerale N. Volg `advice.d_n_req`; als het advies een kleine startgift bij het
  zaaien op percelen met lage Nmin ondersteunt, gebruik die dan, zonder verdere bijbemesting.

**Vermijden:**
- Minerale N-bijbemestingen tijdens het seizoen — onderdrukken knolvorming, verspillen input
  en verhogen nitraatuitspoeling na de oogst.

## Vicia faba — tuinbonen (nl_853, nl_854) en veldbonen (nl_243, nl_311)

Sterke N₂-binding via *Rhizobium leguminosarum* bv. *viciae*. Zelfde regels als voor Pisum:
minimale minerale N, volg `advice.d_n_req`. Tuinbonen en veldbonen zijn in de Nederlandse
agronomie beide *Vicia faba* — pas identieke regels toe ongeacht of het gewas groen wordt
geoogst (nl_854) of droog (nl_853, nl_243, nl_311).

## Glycine max — sojabonen — nl_665

De natuurlijke rhizobia-partner van soja (*Bradyrhizobium japonicum*) komt **niet** van nature
voor in Nederlandse bodems.

**Voorkeur:**
- Bradyrhizobium-**inoculatie is essentieel** op elk perceel zonder recente sojageschiedenis.
  Markeer dit duidelijk in het plan.
- Minimale minerale N zodra inoculatie op orde is; volg `advice.d_n_req`.

**Vermijden:**
- Inoculatie overslaan op percelen waar voor het eerst soja wordt geteeld — zonder inoculatie
  bindt het gewas geen N en valt de opbrengst terug.

## Phaseolus vulgaris — bruine bonen (nl_242), witte bonen (nl_7121), stamslabonen (nl_2779)

Phaseolus heeft onder Nederlandse omstandigheden **zwakkere N₂-binding** dan Vicia of Pisum,
en de binding start ook later in het seizoen. Een bescheiden startgift N maakt daarom vaak deel
uit van het Nederlandse advies voor deze gewassen.

**Voorkeur:**
- Een startgift N bij het zaaien zoals geleverd door `advice.d_n_req` — ga niet uit van nul N
  zoals bij erwten/veldbonen.
- B en Mo volgens `advice.d_b_req` / `advice.d_mo_req`; Phaseolus is B-gevoeliger dan de
  andere peulvruchten.

**Vermijden:**
- Phaseolus behandelen als erwten/veldbonen en de startgift N overslaan — opkomst en vroege
  groei lijden op koude of N-arme gronden.
