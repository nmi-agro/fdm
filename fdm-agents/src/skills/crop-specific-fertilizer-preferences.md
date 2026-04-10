# Crop-Specific Fertilizer Preferences and Restrictions

Certain crops have strong agronomic preferences or quality-driven restrictions on fertilizer
types, independent of legal gebruiksruimte limits. Apply these rules when selecting and
scheduling fertilizers for each field. Always mention deviations in the plan summary so the
farmer understands why a particular product was chosen or excluded.

**Important**: `advice.d_n_req` (and the other `advice.d_*_req` fields) always remains the
primary agronomic target. The N rate indications in this skill are directional guardrails only
— they help you judge whether the advice seems reasonable for the crop type, but never override
the field-specific advice. If the advice diverges significantly from the expected range, flag
it in the plan rather than substituting your own number.

Where soil-dependent risks are noted (e.g. Mn deficiency on calcareous soils, schurft pH),
these are **caution flags** to mention in the plan. Only take action (e.g. include foliar Mn,
recommend liming) when supported by the corresponding advice field (`advice.d_mn_req`,
`advice.d_ca_req`, etc.) or confirmed soil analysis data. Do not assume soil conditions from
`b_soiltype_agr` alone.

---

## Aardappelen (potatoes)

Potato fertilizer strategy differs fundamentally between market segments. Identify the segment
from the crop catalogue code and apply the matching rules below.

### Zetmeelaardappelen (starch potatoes) — nl_2017, nl_3732, nl_859

Grown mainly in Veenkoloniën / Noordoost-Nederland for starch industry (AVEBE). Quality is
measured by **onderwatergewicht (OWG)** — the primary payment parameter.

**Avoid:**
- Chloride-containing fertilizers (KCl / kali-60): **absolutely forbidden**. Even moderate Cl
  reduces OWG and thus starch yield. Only K₂SO₄ (zwavelzure kali) or patentkali as K source.
- Excess N beyond `advice.d_n_req`: zetmeel is sensitive to over-fertilisation — excess N
  delays afsterving and lowers OWG. The N advice for zetmeel is typically moderate; respect it
  closely.

**Prefer:**
- Patentkali (K₂SO₄·MgSO₄) as the main K source — simultaneously supplies Mg and S, both
  important on the typically Mg-poor sandy soils in Veenkoloniën.
- Split N: ~60 % at planting, ~40 % top-dress at knolzetting.
- Early P application (starter or pre-plant) — zetmeelaardappelen on the P-poor sandy soils
  of the Veenkoloniën are highly P-responsive in cold springs.
- Organic manure (rundveedrijfmest, varkensdrijfmest) applied before ridging — limit dose to
  avoid excessive N at emergence.

**Extra attention:**
- Magnesium: zetmeelaardappelen are very sensitive to Mg deficiency on acid sandy soils.
  Verify Mg supply from patentkali or kieseriet if soil Mg is low.
- Manganese: common deficiency on reclaimed peat soils in the region. Check
  `advice.d_mn_req`; foliar Mn spray when symptoms appear.
- Boron: necessary for tuber skin quality; include B when `advice.d_b_req > 0`.

### Fritesaardappelen (processing / fries potatoes) — nl_2014, nl_1909, nl_1910, nl_2951, nl_3792

Grown for frites industry (e.g. Aviko, LambWeston, Farm Frites). Quality is measured by
**bakkleur** (fry colour) and **drogestof** (dry matter, target 19–24 %).

**Avoid:**
- KCl (kali-60): chloride increases reducing sugars → dark fry colour (Maillard reaction).
  Always use K₂SO₄ or patentkali for processing potatoes.
- Late N applications (after eind juli): delays afrijping, increases reducing sugars, and
  lowers drogestof.

**Prefer:**
- N advice for frites is typically higher than for zetmeel — frites require large, elongated
  tubers. Follow `advice.d_n_req` and split: ~50 % pre-plant, ~25 % at knolzetting, ~25 % at
  knolgroei.
- Calcium: important to prevent inwendig bruin (internal brown spot). Include Ca when
  `advice.d_ca_req > 0`, e.g. kalksalpeter as partial N source.
- Patentkali for K + Mg + S supply.

**Extra attention:**
- Drogestof must stay within contract range (typically 19–24 %). Excess N lowers drogestof.
- Boron: include B when `advice.d_b_req > 0`.

### Tafelaardappelen (fresh market / table potatoes) — nl_1911, nl_1912

Quality is measured by appearance (smooth skin, no schurft) and taste (drogestof, kookkwaliteit).

**Avoid:**
- Liming on sandy soils intended for tafelaardappelen: low pH suppresses common scab
  (schurft). If soil pH data shows pH > 5.5 on sand, note the increased schurft risk in the
  plan. Only lime if pH is critically low for the rotation as a whole.
- Excess N beyond `advice.d_n_req`: produces large, watery tubers with poor taste and reduced
  drogestof. Tafelaardappelen N advice is typically moderate.

**Prefer:**
- Follow `advice.d_n_req` with split applications.
- K₂SO₄ preferred over KCl for overall tuber quality, though Cl sensitivity is lower than for
  frites/zetmeel.
- Boron for skin quality; check `advice.d_b_req`.

### Pootaardappelen (seed potatoes) — nl_2015, nl_2016, nl_1928, nl_1929, nl_3730, nl_3731

Grown for NAK-certified seed. Goal is uniform, small-to-medium tubers (28–55 mm sortering).

**Avoid:**
- Excess N: pootaardappelen have the lowest N advice of all potato types. Oversized tubers are
  rejected or down-graded. Excess N also delays loofvernietiging timing. Follow
  `advice.d_n_req` strictly — do not exceed it.
- Late N: seed growers destroy haulm early (June–July) to prevent virus spread. Any N applied
  late is wasted.
- KCl: seed potato contracts increasingly require quality parameters that are Cl-sensitive.

**Prefer:**
- Front-loaded N: ~70 % at planting, max ~30 % top-dress shortly after emergence.
- K₂SO₄ or patentkali.
- Manganese: important on calcareous/high-pH soils (Flevoland, Noordoostpolder — major
  pootaardappel regions). Include foliar Mn when `advice.d_mn_req > 0`.

### All potato types — cross-cutting notes

- **Magnesium**: all potato types are Mg-sensitive. Verify Mg from patentkali/kieseriet if
  soil Mg is low.
- **Boron**: necessary for tuber skin quality across all types. Include B source when
  `advice.d_b_req > 0`.
- **Organic manure**: apply before ridging; limit dose to control early N.
  Prefer rundveedrijfmest for better N/K ratio than varkensdrijfmest.
- **Ammonium-N early**: prefer NH₄⁺ form early season on sandy soils (KAS/CAN rather than
  pure nitrate) to reduce leaching risk.

---

## Suikerbieten (sugar beet) — nl_256

**Prefer:**
- Sodium (Na): suikerbieten respond positively to Na (improved turgidity, partial K
  replacement, yield increase on Na-deficient soils). **Only apply Na when `advice.d_na_req > 0`
  or regional Na deficiency is established.** Apply as landbouwzout (NaCl) or Na-containing
  compound fertilizer to meet the advised amount. Mention explicitly in the plan.
- KCl (kali-60) is **acceptable** for suikerbieten — unlike aardappelen, beets tolerate Cl
  and the Na in NaCl is beneficial.
- Boron: critical for sugar beet; hartrot (heart rot) occurs without adequate B. Include B
  (borax, solubor) to meet `advice.d_b_req`.

**Avoid:**
- Large single doses of N late in the season: excess N in August–September lowers
  suikergehalte (sugar content) and raises impurities (amino-N, K, Na in juice — the
  "winbaarheid"). Keep N timing early (before or at sowing, maximum up to 6-bladstadium).

**Extra attention:**
- Manganese: Mn deficiency (mangaangebrek / "moerasziekte") is a well-known problem on
  calcareous soils with high pH (>7.2) and high organic matter content. Check
  `advice.d_mn_req`; foliar Mn spray may be needed, especially in dry springs when Mn
  availability in soil is further reduced.
- Magnesium: beets are moderately sensitive to Mg deficiency on light soils. Include Mg
  (kieseriet, patentkali) if soil Mg is low.

---

## Voederbieten (fodder beet) — nl_257, nl_2651

Agronomically similar to suikerbieten but with higher total yield targets and less focus on
sugar purity. Apply the same rules as suikerbieten with these modifications:

- Na is still beneficial but less critical than for suikerbieten. Only apply if
  `advice.d_na_req > 0`.
- B remains critical (same hartrot risk).
- Higher N rates are acceptable since suikergehalte is not the quality parameter.
  Follow `advice.d_n_req`.
- Mn deficiency same risk profile as suikerbieten.

---

## Wintertarwe / Zomertarwe (winter wheat / spring wheat) — nl_233, nl_234

**Prefer:**
- Split N applications: typically 3 splits for wintertarwe — tillering (start growth), stem
  extension (GS31), and flag leaf (GS37–39). The flag-leaf application is key for grain
  protein. Zomertarwe typically 2 splits (sowing + GS31).
- Kalkammonsalpeter (KAS / CAN) as the main N source. Ureum can be used but must be
  incorporated within 4 hours of application or applied with a urease inhibitor (NBPT) to
  comply with ammonia emission regulations. Do not broadcast ureum without incorporation.
- Sulphur: winter wheat is sensitive to S deficiency since EU sulphur emission reductions.
  Include S application (ammoniumsulfaat, KAS+S, or kieseriet) at GS31 to meet
  `advice.d_s_req`.

**Avoid:**
- Chloride-heavy fertilizers close to harvest — Cl at high rates marginally reduces grain
  quality (hectolitregewicht).
- Very early spring N on waterlogged soils — leads to denitrification and leaching without
  crop uptake.

**Extra attention:**
- Manganese: Mn deficiency is common in wintertarwe on calcareous/high-pH clay soils
  (especially Zeeland, Flevoland). Symptoms appear in tillering–stem extension. Check
  `advice.d_mn_req`; foliar Mn application (MnSO₄) is standard practice in affected regions.
  Dose to meet `advice.d_mn_req`.
- Copper: on organic/peaty soils with low Cu availability, check `advice.d_cu_req` — Cu
  deficiency causes white tip symptoms and poor grain set.

---

## Wintergerst / Zomergerst (winter barley / spring barley) — nl_235, nl_236

**Prefer:**
- Same split N approach as wheat but with **lower total N rates**. For **brouwgerst** (malting
  barley), the protein content must typically be 9.5–11.5 % (exact threshold depends on the
  farmer's contract with the malt house). Excess N raises protein above malt quality
  thresholds. If the field is designated for brouwgerst, flag an intent question if N advice
  pushes toward higher protein risk.
- Voergerst (feed barley) has no protein ceiling — standard N advice applies.
- Sulphur: similar sensitivity to wheat; include S at stem extension if `advice.d_s_req > 0`.

**Avoid:**
- Exceeding total N advice by even 10–15 kg/ha when growing brouwgerst — contracts often
  have N ceiling clauses with financial penalties.
- Chloride sources for K when soil K is already adequate.

**Extra attention:**
- Manganese: same risk profile as wintertarwe on calcareous soils. Check `advice.d_mn_req`.

---

## Maïs (snijmaïs, korrelmais, CCM, MKS) — nl_259, nl_316, nl_317, nl_814, nl_1935, nl_2032

**Prefer:**
- Varkensdrijfmest or rundveedrijfmest applied shortly before or at sowing
  (werkingscoëfficiënt for N is highest when applied in spring). Maïs is an ideal crop for
  filling manure space.
- **Rijenbemesting (row/starter fertilization)**: NP starter fertilizer placed in the row at
  sowing is **standard practice** in Dutch maize cultivation. It improves early establishment
  on cold soils and ensures P availability when root volume is still small. Allocate ~10–15 %
  of total N advice and ~10–15 % of total P advice as rijenbemesting (e.g. NP 26-14, DAP, or
  liquid starter).
- Zinc (Zn): maïs can show Zn deficiency on calcareous or high-pH soils; check
  `advice.d_zn_req`.

**Avoid:**
- N applied too early in cold springs: N is lost through denitrification before root uptake.
  Target slurry application after soil temp > 8 °C, typically mid-April onwards. The
  rijenbemesting at sowing partially compensates for cold-spring N losses.
- Slurry injection at very high rates in a single pass — split large doses (>35 m³/ha) to
  avoid soil compaction and improve N utilisation.

**Extra attention:**
- Korrelmais (nl_316) and CCM (nl_317) have longer growing seasons than snijmais and may
  benefit from a slightly higher N top-dress, depending on yield targets.
- Suikermais (nl_814): grown as a vegetable crop with higher quality demands; treat more like
  a vegetable crop with attention to even N supply.
- Phosphate: maïs is highly responsive to P in cold soils early season; if soil P (Pw) is
  low, ensure early P supply beyond just the rijenbemesting.

---

## Grasland (grassland / permanent pasture) — nl_265, nl_266, nl_331

**Prefer:**
- Rundveedrijfmest as the primary manure product — matches the typical dairy farm system and
  has a favourable N/P ratio for grassland.
- Multiple N applications aligned with growth cuts: typically 4–6 applications split across
  cutting/grazing cycles from February to August.
- KCl (kali-60) is acceptable for **maaigrasland** (cutting) — chloride sensitivity is not a
  concern for grass.
- Sulphur: grassland often responds to S, especially in first cut. Include S if
  `advice.d_s_req > 0`.
- Bekalking (liming): if `advice.d_ca_req > 0` or soil pH data shows pH below target
  (pH-KCl ≥ 5.0 on sand, ≥ 5.5 on clay), include Ca application for optimal grass production
  and clover persistence. Grass/clover mixtures are particularly pH-sensitive.

**Avoid:**
- Varkensdrijfmest in high single doses on grassland — the high P content risks P run-off on
  saturated soils and can push farm P balance beyond legal limits.
- Late N applications after 1 September — risk of luxury N uptake without biomass removal,
  and increased nitrate leaching risk in autumn.

**Extra attention — weidegrasland (grazing):**
- **Kopziekte (grass tetany / hypomagnesaemia)**: on weidegrasland grazed by dairy cattle in
  spring, avoid high K applications in the first grazing cut. High K in grass suppresses Mg
  uptake by cattle (K/Mg antagonism), increasing kopziekte risk. Prefer to apply K-rich
  fertilizers (including KCl) after the first grazing rotation, or on cutting-only fields.
  Ensure adequate Mg in the fertilizer plan (kieseriet, MgO) when K levels are high.
- Selenium (Se) and Cobalt (Co): relevant for livestock health on Se/Co-poor soils
  (mostly sandy soils in eastern/southern NL). If the farmer raises this concern, Se/Co can
  be supplied via fertilizer (e.g. natriumseleniet) or animal feed supplementation.

---

## Natuurgrasland (natural grassland, nature function) — nl_332

nl_332 is grassland with nature as its primary function. **Do not apply the production
grassland rules above.** Fertiliser inputs on natural grassland are minimal by design.

- Only fertilize if the field-specific `advice.d_n_req` explicitly supports it and legal
  norms allow it.
- Organic manure (rundveedrijfmest at low rates) is typically the only input, if any.
- Do not apply mineral N, intensive K, or multiple split applications.
- If `advice.d_n_req = 0` or no advice is returned, assume zero fertilization.

---

## Uien (onions) — nl_262, nl_263, nl_1931, nl_1932, nl_1933, nl_1934, nl_6660, nl_6664

**Prefer:**
- Sulphur: essential for flavour compound synthesis (thiosulfinates). Include S
  (ammoniumsulfaat or KAS+S) to meet `advice.d_s_req`.
- Potassium as sulphate form (K₂SO₄) rather than KCl where possible — Cl can affect storage
  quality (neck firmness, rot resistance).

**Drijfmest (slurry):**
- Drijfmest is acceptable for uien but **only when applied well before sowing** (at least
  2–4 weeks, early spring). This allows incorporation and more predictable N mineralisation.
- Keep the dose limited (max ~15–20 m³/ha rundveedrijfmest) to avoid excess N late in the
  season. Varkensdrijfmest has higher N and P per m³ — use lower doses and account for the
  higher nutrient load.
- **Never apply drijfmest at or shortly before sowing** — risk of uneven N release, soft
  bulbs, and increased disease pressure (Fusarium, bacterierot).
- Close the remaining N gap with mineral fertilizer (KAS, ammoniumsulfaat) based on
  `advice.d_n_req`.

**Avoid:**
- High N rates late in season (after bulb formation begins, typically from July): increases
  risk of neck rot (*Botrytis allii*), delays skin ripening, and reduces storage life.
- Fresh or unincorporated manure at sowing — risk of disease (Sclerotium cepivorum, witrot)
  and delayed establishment.

**Extra attention:**
- Zaaiuien (nl_262, nl_6660, nl_6664) have a shorter growing season than plantuien
  (nl_1931–nl_1933); adjust N timing accordingly — front-load N for zaaiuien.
- Sjalotten (nl_1934): same quality rules as uien; S is equally important for flavour.

---

## Prei (leeks) — nl_2749, nl_2799, nl_2801

**Prefer:**
- Split N applications: prei has a long growing season (especially winterprei, nl_2799) with
  sustained N demand. Follow `advice.d_n_req` and split: at planting + 1–2 mineral
  top-dressings during the growing season.
- Potassium: important for winter hardiness in winterprei. K₂SO₄ preferred over KCl.
- Sulphur: prei belongs to the Allium family — S is important for flavour and storability.
  Include S when `advice.d_s_req > 0`.

**Avoid:**
- Excess N late in season (after September for winterprei): increases Thrips tabaci
  susceptibility, causes soft tissue, and increases storage rot risk.
- Fresh manure: risk of Fusarium and bacterial soft rot; use only well-composted organic
  inputs or mineral fertiliser.

**Extra attention:**
- Zomerprei (nl_2801): shorter growing season and lower N advice than winterprei.
  Front-load N and finish early.

---

## Peen (carrots) — nl_2717, nl_2783, nl_2785

Includes bospeen (nl_2717), waspeen (nl_2783), and winterpeen (nl_2785).

**Prefer:**
- Low total N rates; carrots fork and branch with excess N. Stick strictly to
  `advice.d_n_req`.
- Potassium: important for root quality and colour; use K₂SO₄ to avoid Cl.
- Boron: carrot tip-burn and cavity spot are partly linked to B; include B when
  `advice.d_b_req > 0`.
- Calcium: adequate Ca reduces cavity spot risk. Include Ca when `advice.d_ca_req > 0`.

**Avoid:**
- Fresh manure or high organic N inputs close to sowing — excess N and uneven mineralisation
  cause forked roots and reduced marketability. Only use well-composted organic matter,
  preferably applied in the preceding autumn.
- KCl as sole K source — may affect root texture and taste.

**Extra attention:**
- Winterpeen (nl_2785): longer growing season than waspeen; may need a small N top-dress
  mid-season if growth stalls, but keep total N conservative per `advice.d_n_req`.

---

## Witlofwortel (chicory root for forcing) — nl_2787

Witlofwortel is agronomically distinct from carrots — root quality determines trek (forcing)
success in winter. Do not apply generic carrot rules.

**Prefer:**
- Moderate, even N supply per `advice.d_n_req`. Excess N produces soft, disease-prone roots
  that store poorly and give low-quality witlof during trek.
- Potassium: important for root firmness; K₂SO₄ preferred.

**Avoid:**
- Excess N: the most common mistake — high N gives large but soft roots with poor storage
  quality and increased rot risk during forcing.
- Fresh manure or late organic N inputs — uneven mineralisation causes variable root quality.

---

## Koolgewassen (brassicas)

All brassicas share common fertilizer themes (high S demand, B/Mo sensitivity, pH management
for knolvoet). The crop-specific notes below highlight where N management and timing differ.

### Common rules for all koolgewassen

**Prefer:**
- Sulphur: all brassicas are glucosinolate producers and have a high S demand. **Always**
  include S to meet `advice.d_s_req`.
- Boron: B deficiency causes hollow stem in broccoli and bloemkool. Include B to meet
  `advice.d_b_req`.
- Split N: brassicas generally benefit from split N (at planting + 1–2 top-dresses). Single
  large N doses cause rank vegetative growth and uneven head/sprout development.

**Avoid:**
- Acid soils: knolvoet (club root, *Plasmodiophora brassicae*) thrives in acid conditions.
  If `advice.d_ca_req > 0` or soil pH data indicates low pH, flag the knolvoet risk and
  recommend liming. Target pH > 7.0 on clay, > 5.8 on sand for brassica fields.
- Single large N dose at planting — causes rank vegetative growth and delayed maturity.

**Extra attention:**
- Molybdenum: bloemkool is sensitive to Mo deficiency ("zweepstaart" / whiptail). Check
  `advice.d_mo_req`; include Mo at low rates if flagged.
- Calcium: important for tip-burn prevention in bloemkool. Include Ca when
  `advice.d_ca_req > 0`.

### Spruitkool (Brussels sprouts) — nl_2777

- Very long growing season (April–January) and among the highest N-demanding field crops in
  NL. Follow `advice.d_n_req` and split over 3–4 applications throughout the season.
- Late N top-dress (September–October) is acceptable and necessary for spruitkool — unlike
  most crops, spruitkool is still actively growing in autumn.

### Bloemkool / Broccoli — nl_2713, nl_2719, nl_2795, nl_2797

- High N demand but shorter growing season than spruitkool. Follow `advice.d_n_req` with
  2–3 splits.
- Winterbloemkool (nl_2795): overwintering crop — ensure adequate K for winter hardiness.

### Sluitkool (rodekool, wittekool, savooiekool, spitskool) — nl_2759, nl_2761, nl_2775, nl_2789

- Moderate to high N demand. Follow `advice.d_n_req` with 2 splits (at planting + 1 top-dress).
- Storage quality (especially rodekool, wittekool) benefits from K₂SO₄ over KCl.

---

## Koolzaad / Raapzaad (oilseed rape) — nl_1922, nl_1923, nl_664, nl_7124

**Prefer:**
- Sulphur: the highest S-demanding arable crop in Dutch cropping systems. **Always** include S
  supply to meet `advice.d_s_req`. Apply in spring at green-up (most effective timing). If
  autumn application is also possible, split across autumn + spring.
- Split N: 2–3 spring applications at green-up, stem extension, and pre-flowering. Autumn N
  (~15–20 % of total N advice) is only advisable if the crop was sown early (before end of
  August) and establishment is poor. Many well-established autumn crops do not need autumn N.
- Boron: koolzaad is sensitive to B deficiency (hollow stems, poor pod set). Include B to
  meet `advice.d_b_req`.

**Avoid:**
- High single-dose spring N: risk of lodging and uneven ripening.
- Slurry applied in autumn at full dose — large part of N is lost over winter; a moderate
  autumn slurry application (for P/K/S) followed by mineral N in spring is more efficient.

---

## Peulvruchten (legumes) — nl_239, nl_241, nl_244, nl_308, nl_2650, nl_242, nl_243, nl_311, nl_665, nl_853, nl_854, nl_2779, nl_7121

Includes erwten (nl_239, nl_241, nl_244, nl_308, nl_2650), veldbonen (nl_243, nl_311),
bruine bonen (nl_242), stamslabonen (nl_2779), tuin-/sojabonen (nl_853, nl_854, nl_665).

**Prefer:**
- Minimal N input: legumes fix atmospheric N₂ via rhizobia. A small starter N dose at
  sowing only if soil mineral N (Nmin) is low, no further mineral N top-dressing.
- Phosphate and potassium supply is often more important than N for these crops. Ensure P and
  K advice is met (`advice.d_p_req`, `advice.d_k_req`).
- Molybdenum (Mo): essential cofactor for nitrogenase; include trace-amount Mo when
  `advice.d_mo_req > 0`, especially on acid soils where Mo availability is low.
- Inoculation: for sojabonen (nl_665) on fields without soja history, Bradyrhizobium
  inoculation is essential — flag this in the plan if soja is grown.

**Avoid:**
- High N applications — suppresses nodulation and biological N₂ fixation, wastes input, and
  increases nitrate leaching after harvest.
- Slurry at sowing — risk of surface compaction and reduced emergence.

**Extra attention:**
- N-nalevering (residual N): peulvruchten leave significant residual N for the following crop.
  Note this in the plan for rotation-level N planning.

---

## Haver (oats) — nl_238, nl_6636

**Prefer:**
- N advice for haver is lower than for wheat. Follow `advice.d_n_req` — haver is efficient
  at N uptake but lodging-prone at high N rates.
- Split N: 2 applications — at tillering and stem extension. Flag-leaf application is less
  critical than for wheat.
- KAS as the main N source.

**Avoid:**
- Excess N beyond `advice.d_n_req`: haver has weak straw — lodging reduces yield and
  complicates harvest.
- Late N: limited grain protein benefit compared to wheat.

**Extra attention:**
- Manganese: haver is sensitive to Mn deficiency on alkaline soils. Check `advice.d_mn_req`.

---

## Rogge (rye) — nl_237, nl_7130

**Prefer:**
- Rogge is the most nutrient-efficient cereal on poor sandy soils. N advice is typically low.
  Follow `advice.d_n_req`.
- Single or 2-split N application (early spring + stem extension).

**Avoid:**
- Excess N beyond `advice.d_n_req`: rogge has very long straw — excess N causes severe
  lodging.

**Extra attention:**
- Rogge is commonly grown on sandy soils in eastern/southern NL where soils are acid and
  nutrient-poor. Ensure basic soil fertility (pH, K, P) is addressed.
- N-nalevering: rogge has limited residual N value for the following crop.

---

## Vlas (flax) — nl_249, nl_666, nl_3736

**Prefer:**
- Vlas has a very low N requirement — one of the lowest among Dutch arable crops. Follow
  `advice.d_n_req` strictly. Excess N causes lodging, reduces fibre quality (vezelvlas), and
  delays ripening.
- Potassium: moderate K demand; K₂SO₄ or KCl both acceptable (no Cl sensitivity).
- Zinc: vlas can show Zn deficiency; check `advice.d_zn_req`.

**Avoid:**
- N above advice: lodging is the primary yield and quality limiter. Stick strictly to
  `advice.d_n_req`.
- Fresh manure: risk of uneven N mineralisation causing lodging patches.

---

## Crops Not Listed Above (fallback)

For crops not covered by a specific section above:
1. Follow the standard gap-closing workflow from the `fertilizer-selection` and
   `nutrient-advice-targeting` skills.
2. Apply general principles: K₂SO₄ over KCl for quality-sensitive crops (vegetables, root
   crops, fruit); KCl is acceptable for cereals and grassland.
3. Check all micro-nutrient advice fields (`advice.d_b_req`, `advice.d_mn_req`,
   `advice.d_zn_req`, `advice.d_mo_req`, `advice.d_cu_req`) and include appropriate products
   if any are flagged.
4. When in doubt about crop-specific sensitivity, note in the plan that no specific
   crop-fertilizer rule was available and standard advice was followed.

---

## Interpretation and Communication

When you apply a crop-specific rule:
1. Note it in the plan summary: e.g. *"Voor zetmeelaardappelen is KCl vermeden; K is als K₂SO₄
   toegediend vanwege het onderwatergewicht."* or *"Rijenbemesting met NP-meststof is
   opgenomen voor de maïspercelen."*
2. If the available fertilizers in the system do not include the preferred product, note the
   gap and suggest the farmer procures it, or explain which available product is the best
   alternative.
3. If an intent question has already established the farmer's preference (e.g. they specifically
   want to use a certain manure product), respect that preference unless it creates a legal
   violation or a serious quality risk — in which case, flag the conflict clearly.
4. When soil-type dependent recommendations apply (e.g. Mn on calcareous soils, schurft pH
   management on sand), verify the field's soil type before applying the rule.
