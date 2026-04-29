# Orchard fruit and small fruit (fruitteelt)

Includes:
- **Pome and stone fruit**: apple (nl_212 generic, nl_1095 planted current season,
  nl_1096 planted previous season), pear (shared under nl_212), plum (nl_1870), cherry
  (nl_1872 sour, nl_2328 sweet).
- **Small fruit / soft fruit**: blueberry (nl_1869), blackcurrant (nl_1873), redcurrant
  (nl_2325), raspberry (nl_2326), gooseberry / other small fruit (nl_1874).
- **Strawberry, open ground**: nl_2700 (propagation), nl_2701 (waiting bed), nl_2702
  (production), nl_2703 (seeds / propagation).
- **Strawberry on raised tabletops (stellingen)**: nl_2704–nl_2707 (same role split).

Fruit growing is a perennial sector with strongly **leaf-analysis-driven** fertilization;
annual soil analysis alone is not sufficient. Refer to the relevant sector fertilizer
guidance for species- and cultivar-specific rates; this skill provides only the general
envelope.

> **Strawberry is botanically small fruit but agronomically closer to field vegetables**
> — see the strawberry section below.

## Pome and stone fruit — apple, pear, plum, cherry (nl_212, nl_1095, nl_1096, nl_1870, nl_1872, nl_2328)

**Prefer:**
- **Leaf-analysis-driven** N, P, K, Mg, Ca, B, Mn, Zn — request the annual leaf analysis
  from the grower and combine it with `advice.d_*_req`.
- Split N: small early-spring application (bud swelling / mouse-ear stage) plus a second
  application after flowering. An autumn leaf-fall foliar urea application after harvest
  for leaf-reserve formation is common in apple — this is foliar, not a soil
  application.
- K as K₂SO₄ / patentkali — KCl is unusual in fruit: apple is moderately Cl-sensitive,
  and patentkali also supplies the Mg that apple structurally needs.
- Magnesium per `advice.d_mg_req` — apple has a strong Mg requirement (Mg deficiency
  causes leaf browning and pre-harvest drop).
- Boron per `advice.d_b_req` — pear and plum in particular are B-sensitive (poor fruit
  set).
- Calcium for apple: bitter pit in Elstar, Jonagold etc. is a classic Ca-translocation
  problem. Soil Ca alone is not sufficient — repeated Ca foliar sprays from fruit set
  to just before picking are standard practice. `advice.d_ca_req` covers the soil part,
  not the foliar sprays.

**Avoid:**
- High N in young plantings (nl_1095, nl_1096): produces overly vigorous growth at the
  cost of early production and root development. `advice.d_n_req` accounts for age.
- N applications after mid-July in apple: reduce fruit colouring and storage life
  (Jonagold, Elstar, Kanzi); for pear (Conference) it shortens storage life.
- KCl in mature plantings — Cl load in fruit and leaves.
- Fresh slurry directly around the trunk — root damage and salt stress.

**Extra attention:**
- In modern orchards fertilization is often delivered via **fertigation / drip**; the
  rates from `advice.d_*_req` still apply, only the delivery route differs.
- Hail nets / rain covers in modern pome and stone fruit affect N mineralisation (lower
  soil temperature); when in doubt, be slightly more cautious with early N.
- For young plantings (nl_1095, nl_1096), structure and soil moisture are more
  important than fertilization — flag this if the grower presents a newly planted
  orchard.

## Small fruit — currants, raspberry, gooseberry (nl_1869, nl_1873, nl_2325, nl_2326, nl_1874)

**Prefer:**
- **Blueberry (nl_1869)** requires an **acid soil** (pH-KCl 4.0–5.0). **No liming** in
  blueberry plantings; instead, acidification with elemental S or acid organic matter
  (peat, coniferous compost) is standard. `advice.d_ca_req > 0` in blueberry is a
  signal that the field is unsuitable and must appear as a warning in the plan.
- Black / red currants, gooseberries: pH-KCl 5.5–6.0 on sand, higher on clay; follow
  `advice.d_ca_req`.
- Split N with base in spring and a small top-dress after flowering; no N after
  mid-July.
- K as K₂SO₄ — all small fruits are Cl-sensitive.
- Boron and Mg per `advice.d_b_req` / `advice.d_mg_req`.

**Avoid:**
- KCl on small fruit — leaf-margin scorch and reduced shelf life.
- Liming in blueberry plantings — destroys the entire cropping system.
- Fresh slurry between the bushes — root damage and disease risk.

## Strawberry (nl_2700–nl_2707)

Strawberry is **short-perennial** (1–2 production years) and agronomically closest to
field vegetables.

**Prefer:**
- Base NPK before planting (July–August for everbearer / waiting-bed plants;
  August–September for June-bearers); spring top-dress for the production field.
- Fertigation where available — strawberry is a classic fertigation crop on tabletops
  and ridge systems.
- K as K₂SO₄ — strawberry is Cl-sensitive (fruit quality, taste, shelf life).
- Boron and Ca per `advice.d_b_req` / `advice.d_ca_req` — Ca against leaf-margin
  symptoms and soft fruit.

**Avoid:**
- High N during fruiting — soft fruit, *Botrytis*, taste loss.
- Fresh slurry in production fields — *Phytophthora* and *Botrytis* risk, and food-
  safety considerations.
- KCl in production fields.

**Tabletop production (nl_2704–nl_2707)**: fertilization via nutrient solution and
fertigation; this skill covers only the general envelope. Refer to the grower's or
propagator's specific feeding schedules.

**Propagation and waiting beds (nl_2700, nl_2701, nl_2704, nl_2705)** require lower N
than production (controlled growth, no fruiting wanted); `advice.d_n_req` accounts for
this stage.

**Extra attention (all fruit types):**
- Soil and leaf analysis are both needed; soil analysis alone over- or under-estimates
  the actual supply in a perennial planting.
- Residual N from a grubbed-out old planting or a grass strip between rows is
  significant; factor this into the following year via the standard fdm-calculator
  workflow, not here.
