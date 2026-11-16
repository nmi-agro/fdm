# Farm Data Model

The shared language of FDM: the farms, fields, crops, fertilizers and soil data it records, and the norms and plans it derives from them. Each term gives the English name used in code and docs, with the Dutch label of the app in brackets.

## Language

### Farms and access

**Farm** (_Bedrijf_):
An agricultural business that manages fields and fertilizers, and for which plans and norms are calculated.
_Avoid_: business, company, holding

**Organization** (_Organisatie_):
A group of users that receives roles on farms together.

**Farm group** (_Groepen_):
A set of farms within an organization, used for grouping only; it grants no access to those farms.

**Role** (_Rol_):
The access a user or organization has to a farm: Owner (_Eigenaar_), Advisor (_Adviseur_) or Researcher (_Onderzoeker_).

**Derogation** (_Derogatie_):
Permission for a farm, for a specific year, to apply more nitrogen from animal manure than the standard norm allows.

**Organic certification** (_Bio-certificaat_):
Proof that a farm is certified organic, valid between its issue and expiry date.

**Grazing intention** (_Beweidingsintentie_):
A farm's declaration, for a given year, whether it intends to graze livestock; the norms use it. If livestock did graze that year, the intention must be yes.

**Measure** (_Maatregel_):
An agricultural practice that a farm adopts, for example to improve soil quality.

### Fields and crops

**Field** (_Perceel_):
A piece of land with a fixed boundary that a farm manages for a period.
_Avoid_: parcel, plot

**Field acquiring** (_Eigendom of pacht_):
How a field comes into use at a farm, such as ownership or a form of lease.
_Avoid_: tenure

**Crop** (_Gewas_):
A kind of crop from the catalogue, such as winter wheat or grassland.

**Cultivation** (_Teelt_, shown in the app as _Gewas_):
The growing of one crop on one field, from sowing or planting until it ends.
_Avoid_: land use, crop (for one occurrence)

**Crop residues** (_Gewasresten_):
The remains of a cultivation that are left on the field after it ends.

**Crop rotation** (_Bouwplan_):
The overview of which crops a farm grows on which fields.

**Catalogue**:
A standard reference list of crops, fertilizers or measures with their properties, that farms choose from.

### Harvests

**Harvest** (_Oogst_):
The event of harvesting a cultivation on a date; a cultivation can have several harvests.

**Cut** (_Snede_):
A harvest of grassland by mowing (_Maaien_).

**Harvestable** (no app label):
What a harvest yields: the produce on which yield and nutrient content are measured.

### Fertilizers

**Fertilizer** (_Meststof_):
A fertilizer product that a farm uses, either taken from the catalogue or defined by the farm itself.

**Fertilizer application** (_Bemesting_):
One application of a fertilizer to a field on a date, with a quantity and an application method.
_Avoid_: fertilizing, dressing, manuring

**Application method** (_Toedieningsmethode_):
How a fertilizer is applied to a field, such as broadcasting or injection.

**Working coefficient** (_N-werking_):
The share of the nitrogen in a fertilizer that becomes available to the crop.

### Soil

**Soil sampling** (_Bemonstering_):
Taking soil from a field at a date, depth and zone.

**Soil analysis** (_Bodemanalyse_):
The measured soil properties from a soil sampling.
_Avoid_: soil sample

**Current soil data**:
The value of each soil parameter of a field, derived from its soil analyses, that calculations use as input.

**Sampling zone**:
The part of a field that a soil sampling represents; without a zone, it represents the whole field.

**Soil condition score** (_BodemConditieScore_):
A visual assessment of a field's soil that scores indicators such as soil structure.

**BLN soil quality** (_BLN-bodemkwaliteit_):
A soil quality assessment of a field with the BLN indicator system, calculated from soil and field data; a soil condition score can be one of its inputs.

### Norms and plans

**Norm** (_Gebruiksnorm_; the space it leaves is shown as _Gebruiksruimte_ or _Ruimte_):
The legal maximum of a nutrient that may be applied on a field or farm in a year.
_Avoid_: usage space, quota, limit

**Norm filling** (_Opvulling_):
How much of a norm the fertilizer applications use.

**Fertilizer plan** (_Bemestingsplan_):
A farm's plan of fertilizer applications for a year.

### Calculated results

**Nitrogen balance** (_Stikstofbalans_):
The nitrogen supplied to and removed from a field or farm over a year, and the difference between them.

**Organic matter balance** (_Organische-stofbalans_):
The organic matter supplied to a field compared with what breaks down.

**Nutrient advice** (_Bemestingsadvies_):
The recommended doses of nutrients for a cultivation on a field, based on the crop and the current soil data; it names nutrients, not fertilizers.
_Avoid_: fertilizer advice
