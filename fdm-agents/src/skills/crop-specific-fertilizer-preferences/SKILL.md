---
name: crop-specific-fertilizer-preferences
description: Gewasspecifieke bemestingsbeperkingen en -voorkeuren voor de Nederlandse landbouw
---

# Gewasspecifieke bemestingsvoorkeuren en -beperkingen

Bepaalde gewassen hebben sterke agronomische voorkeuren of kwaliteitsgedreven beperkingen
voor meststoftypen, los van wettelijke gebruiksruimte-limieten. Pas deze regels toe bij
het selecteren en plannen van meststoffen voor elk perceel. Noem afwijkingen altijd in de
plansamenvatting, zodat de landbouwer begrijpt waarom een bepaald product is gekozen of
uitgesloten.

**Belangrijk — scheiding van verantwoordelijkheden**: nutriënten*giften* (kg N/P/K/S/Ca/Mg
en micro-elementen per ha) worden geproduceerd door `fdm-calculator` en beschikbaar gemaakt
via de `advice.d_*_req`-velden. Deze skill herhaalt of vervangt die giften nooit. Wat deze
skill biedt, is de kwalitatieve laag die de calculator niet produceert:

- productvoorkeuren en te vermijden producten (bijv. K₂SO₄ versus KCl, ureum versus KAS,
  type drijfmest),
- verdeling van het door de calculator geleverde totaal over meerdere toepassingen
  (deelgiftfracties),
- voorkeursvensters voor timing (groeistadia, weken vóór zaaien, aanwijzingen op basis van
  bodemtemperatuur, RVO-sluitingsdata),
- bandbreedtes voor mestdoseringen (m³/ha) wanneer deze operationeel zijn en niet door de
  nutriëntengift worden gestuurd,
- gewaskwaliteits- / contractreferentiewaarden die de _landbouwer_ moet respecteren
  (brouwgerst-eiwitband, pootaardappel sortering, frites drogestof, OWG, bakkleur, etc.),
- door grondsoort en pH gestuurde _risicosignalen_ die de agent aangeven wanneer het
  relevante `advice.d_*_req`-veld of de bodemanalyse moet worden geraadpleegd.

Waar bodemafhankelijke risico's worden genoemd (bijv. Mn-gebrek op kalkrijke gronden,
schurft pH, knolvoet pH), zijn dit **waarschuwingssignalen** om in het plan te noemen.
Onderneem alleen actie (bijv. Mn-bladvoeding opnemen, bekalking aanbevelen) wanneer dit
wordt ondersteund door het corresponderende adviesveld (`advice.d_mn_req`,
`advice.d_ca_req`, etc.) of door bevestigde bodemanalysegegevens. Leid bodemomstandigheden
niet alleen af uit `b_soiltype_agr`.

## Deze skill gebruiken

Roep vóór het plannen van bemesting voor een perceel `getCropFertilizerGuide` aan met de
gewascataloguscodes voor alle gewassen op dit bedrijf (bijv. `["nl_265", "nl_256"]`). De
tool retourneert alleen de relevante gewassecties, zodat de context gericht blijft. Roep
de tool één keer vroeg in de planning aan, vóór het selecteren van meststoffen voor
afzonderlijke percelen.

### Referentiebestanden met meerdere segmenten

Sommige referentiebestanden dekken meerdere agronomische segmenten onder één
paraplugewas. Wanneer zo'n bestand wordt geretourneerd, kies dan de subsectie waarvan de
cataloguscodes overeenkomen met het perceel, _niet_ de eerste sectie in het bestand:

**Belangrijk**: Als cataloguscodes worden gedeeld door meerdere subsecties (bijv.
"consumptie" in aardappelen.md), moet de agent ook een secundair contextveld matchen (zoals
"destination" of "use" — bijv. frites versus tafel) voordat een subsectie wordt gekozen.
Als die secundaire context ontbreekt, vraag dan het veld op bij de gebruiker of kies bij
wijze van terugval die dubbelzinnige subsectie niet.

- **`aardappelen.md`** — aparte secties voor consumptieaardappelen (generieke codes, bestemming
  onbekend), zetmeelaardappelen, fritesaardappelen, tafelaardappelen en pootaardappelen.
  De generieke "consumptie"-codes (nl_2014, nl_1909, nl_1910, nl_2951, nl_3792) worden gerouteerd
  naar `aardappelen.md` (sectie "Consumptieaardappelen — generieke codes") en de vroege codes
  (nl_1911, nl_1912) naar `vroegeaardappelen.md`. Als de bestemming (frites/tafel) bekend is,
  navigeer dan naar de bijbehorende subsectie; anders gebruik de conservatieve gedeelde regels in de
  generieke sectie.
- **`koolgewassen.md`** — algemene regels voor alle brassicas plus subsecties voor
  spruitkool, bloemkool/broccoli en sluitkool. Wanneer cataloguscodes in meerdere
  subsecties voorkomen, match dan de secundaire context vóór selectie.
- **`peulvruchten.md`** — algemene regels plus genus-subsecties (Vicia faba, Pisum sativum,
  Glycine max, Phaseolus vulgaris) die verschillen in N₂-fixatiekracht en behoefte aan
  starter-N.

---

## Gewassen zonder referentiebestand (fallback)

Voor gewassen zonder eigen referentiebestand:

1. Volg de standaard workflow om tekorten te sluiten uit de skills `fertilizer-selection`
   en `nutrient-advice-targeting`.
2. Pas algemene principes toe: K₂SO₄ boven KCl voor kwaliteitsgevoelige gewassen
   (groenten, wortelgewassen, fruit); KCl is acceptabel voor granen en grasland.
3. Controleer alle adviesvelden voor micronutriënten (`advice.d_b_req`,
   `advice.d_mn_req`, `advice.d_zn_req`, `advice.d_mo_req`, `advice.d_cu_req`) en neem
   passende producten op als er signalen zijn.
4. Noteer bij twijfel over gewasspecifieke gevoeligheid in het plan dat er geen specifieke
   gewas-bemestingsregel beschikbaar was en dat standaardadvies is gevolgd.

---

## Interpretatie en communicatie

Wanneer je een gewasspecifieke regel toepast:

1. Noteer dit in de plansamenvatting: bijv. _"Voor zetmeelaardappelen is KCl vermeden; K is als K₂SO₄
   toegediend vanwege het onderwatergewicht."_ of _"Rijenbemesting met NP-meststof is
   opgenomen voor de maïspercelen."_
2. Als de beschikbare meststoffen in het systeem het voorkeursproduct niet bevatten,
   benoem dan het tekort en stel voor dat de landbouwer het aanschaft, of leg uit welk
   beschikbaar product het beste alternatief is.
3. Als een intentievraag de voorkeur van de landbouwer al heeft vastgesteld (bijv. dat deze
   specifiek een bepaald mestproduct wil gebruiken), respecteer die voorkeur tenzij dit een
   wettelijke overtreding of een ernstig kwaliteitsrisico oplevert — markeer in dat geval
   het conflict duidelijk.
4. Wanneer grondsoortafhankelijke aanbevelingen gelden (bijv. Mn op kalkrijke gronden,
   schurft pH-beheer op zand), verifieer dan de grondsoort van het perceel voordat je de
   regel toepast.
