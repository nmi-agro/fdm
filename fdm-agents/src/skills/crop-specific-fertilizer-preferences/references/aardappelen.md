# Aardappelen (potatoes)

Potato fertilizer strategy differs fundamentally between market segments. Identify the segment
from the crop catalogue code and apply the matching rules below.

## Zetmeelaardappelen (starch potatoes) — nl_2017, nl_3732, nl_859

Grown mainly in Veenkoloniën / Noordoost-Nederland for the starch industry. Quality is
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

## Fritesaardappelen (processing / fries potatoes) — nl_2014, nl_1909, nl_1910, nl_2951, nl_3792

> **Note**: the catalogue codes nl_2014, nl_1909, nl_1910, nl_2951, nl_3792 are generic
> "consumptie" codes that cover both frites and tafel destinations. The segment-specific
> rules below apply when the field is contracted for **frites**. When the destination is
> not known, use `consumptieaardappelen.md` instead and ask the farmer.

Grown for frites industry (e.g. Aviko, LambWeston, Farm Frites). Quality is measured by
**bakkleur** (fry colour) and **drogestof** (dry matter, target 19–24 %).

**Avoid:**
- KCl (kali-60): chloride increases reducing sugars → dark fry colour (Maillard reaction).
  Always use K₂SO₄ or patentkali for processing potatoes.
- Late N applications (after eind juli): delays afrijping, increases reducing sugars, and
  lowers drogestof.

**Prefer:**
- Split N: ~50 % pre-plant, ~25 % at knolzetting, ~25 % at knolgroei. Total N follows
  `advice.d_n_req`.
- Patentkali for K + Mg + S supply.

**Extra attention:**
- Calcium: inwendig bruin (internal brown spot) is partly Ca-related. Manage via early-season
  Ca availability where `advice.d_ca_req > 0` (early bekalking or gips), not via late-season
  N-containing Ca products. Field response to Ca-fertilisation is variable and largely driven
  by irrigation and variety choice.
- Drogestof must stay within contract range (typically 19–24 %). Excess N lowers drogestof.
- Boron: include B when `advice.d_b_req > 0`.

## Tafelaardappelen (fresh market / table potatoes) — nl_1911, nl_1912

> **Note**: nl_1911 and nl_1912 are "vroege consumptie" codes (loofvernietiging vóór 15-07).
> The vroege/primeur regime is covered in `vroegeaardappelen.md`. The general tafel rules
> below apply to fresh-market potatoes regardless of code; use them in combination with the
> vroege guidance for these specific codes.

Quality is measured by appearance (smooth skin, no schurft) and taste (drogestof, kookkwaliteit).

**Avoid:**
- Liming on sandy soils intended for tafelaardappelen: low pH suppresses common scab
  (schurft). On sand, schurftrisico rises once pH-KCl moves above the schurft-suppressing
  range (roughly above ~5.2). Flag this risk in the plan and only lime via `advice.d_ca_req`
  when the rotation as a whole requires it.
- Excess N beyond `advice.d_n_req`: produces large, watery tubers with poor taste and reduced
  drogestof. Tafelaardappelen N advice is typically moderate.

**Prefer:**
- Follow `advice.d_n_req` with split applications.
- K₂SO₄ preferred over KCl for overall tuber quality, though Cl sensitivity is lower than for
  frites/zetmeel.
- Boron for skin quality; check `advice.d_b_req`.

## Pootaardappelen (seed potatoes) — nl_2015, nl_2016, nl_1928, nl_1929, nl_3730, nl_3731

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

## All potato types — cross-cutting notes

- **Magnesium**: all potato types are Mg-sensitive. Verify Mg from patentkali/kieseriet if
  soil Mg is low.
- **Boron**: necessary for tuber skin quality across all types. Include B source when
  `advice.d_b_req > 0`.
- **Organic manure**: apply before ridging; limit dose to control early N.
  Prefer rundveedrijfmest for better N/K ratio than varkensdrijfmest.
- **Ammonium-N early**: prefer NH₄⁺ form early season on sandy soils (KAS/CAN rather than
  pure nitrate) to reduce leaching risk.
