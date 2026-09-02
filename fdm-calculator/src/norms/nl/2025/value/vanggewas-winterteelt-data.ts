/**
 * Catch crop (Vanggewas, Table 6) and Winter crop (Winterteelt, Table 7)
 * crop-code level membership for Dutch Meststoffenwet (2025).
 */

/**
 * Official RVO Table 6 Catch Crop Codes (Vanggewassen op zand- en lössgrond 2025).
 * Exactly 59 official crop codes.
 */
export const VANGGEWAS_2025 = new Set<string>([
  "nl_428", // gele mosterd
  "nl_3502", // bladkool
  "nl_3503", // bladraap
  "nl_3504", // bladrammenas
  "nl_3505", // deder
  "nl_3507", // ethiopische mosterd
  "nl_3508", // facelia
  "nl_3514", // niger
  "nl_3517", // sarepta mosterd/caliente
  "nl_3519", // soedangras/sorghum
  "nl_3520", // spurrie
  "nl_426", // overige groenbemesters, vlinderbloemige
  "nl_6756", // klaver, alexandrijnse, groenbemesting, vanggewas
  "nl_6758", // klaver, incarnaat, groenbemesting, vanggewas
  "nl_6760", // klaver, perzische, groenbemesting, vanggewas
  "nl_6762", // klaver, rode, groenbemesting, vanggewas
  "nl_6764", // klaver, witte, groenbemesting, vanggewas
  "nl_800", // rolklaver
  "nl_801", // esparcette
  "nl_802", // wikke, bonte
  "nl_803", // wikke, voeder
  "nl_3518", // seradelle
  "nl_670", // japanse haver
  "nl_233", // tarwe, winter
  "nl_235", // gerst, winter
  "nl_237", // rogge (geen snijrogge)
  "nl_3510", // boekweit
  "nl_515", // zonnebloemen
  "nl_258", // luzerne
  "nl_663", // lupinen, niet bittere
  "nl_666", // vlas, olie
  "nl_3736", // vlas, vezel
  "nl_3521", // stoppelknollen
  "nl_346", // tagetes erecta (afrikaantje)
  "nl_347", // tagetes patula (afrikaantje)
  "nl_669", // zwaardherik (aaltjesvanggewas)
  "nl_671", // raketblad (aaltjesvanggewas)
  "nl_6748", // beemdlangbloem, groenbemesting, vanggewas
  "nl_6750", // engels raaigras, graszaad
  "nl_6751", // engels raaigras, groenbemesting, vanggewas
  "nl_6752", // festulolium, graszaad
  "nl_6753", // festulolium, groenbemesting, vanggewas
  "nl_6754", // italiaans raaigras, graszaad
  "nl_6755", // italiaans raaigras, groenbemesting, vanggewas
  "nl_6782", // rietzwenkgras, graszaad
  "nl_6783", // rietzwenkgras, groenbemesting, vanggewas
  "nl_6784", // roodzwenkgras, graszaad
  "nl_6785", // roodzwenkgras, groenbemesting, vanggewas
  "nl_6786", // timothee, graszaad
  "nl_6787", // timothee, groenbemesting, vanggewas
  "nl_6788", // veldbeemdgras, graszaad
  "nl_6789", // veldbeemdgras, groenbemesting, vanggewas
  "nl_6790", // westerwolds raaigras, graszaad
  "nl_6791", // westerwolds raaigras, groenbemesting, vanggewas
  "nl_2298", // groenbemesters, vlinderbloemige
  "nl_2299", // groenbemesters, niet-vlinderbloemige
  "nl_7125", // overige groenbemesters, niet-vlinderbloemige
  "nl_7126", // overige gras, groenbemesting, vanggewas
  "nl_7131", // rogge, groenbemesting, vanggewas
])

/**
 * Official RVO Table 7 Winter Crop Codes (Winterteelten op zand- en lössgrond 2025).
 */
export const WINTERTEELT_2025 = new Set<string>([
  // Winter cereals, grasses & green manures
  "nl_233", // wintertarwe
  "nl_382", // spelt
  "nl_235", // wintergerst
  "nl_314", // triticale
  "nl_237", // rogge
  "nl_6806", // snijrogge
  "nl_3509", // rogge groenbemesting
  "nl_7131", // rogge vanggewas
  "nl_670", // japanse haver
  "nl_265", // blijvend grasland
  "nl_266", // tijdelijk grasland
  "nl_331", // natuurlijk grasland landbouw
  "nl_332", // natuurlijk grasland natuur
  "nl_3805", // gras industriële verwerking
  "nl_1921", // graszoden
  "nl_1915", // rietzwenkgras
  "nl_1916", // veldbeemd
  "nl_1917", // roodzwenkgras 1e jaar
  "nl_1918", // roodzwenkgras overjarig
  "nl_1919", // westerwolds
  "nl_1920", // italiaans
  "nl_2030", // engels raai 1e jaar
  "nl_2031", // engels raai overjarig
  "nl_3506", // engels raaigras
  "nl_3512", // italiaans raaigras
  "nl_3513", // westerwolds raaigras
  "nl_3516", // rietzwenkgras
  "nl_3523", // veldbeemdgras
  "nl_3807", // rietzwenkgras
  "nl_3808", // roodzwenkgras
  "nl_6746", // veldbeemdgras
  "nl_6747", // beemdlangbloem
  "nl_6748", // beemdlangbloem vanggewas
  "nl_6750", // engels raaigras
  "nl_6751", // engels raaigras vanggewas
  "nl_6752", // festulolium
  "nl_6753", // festulolium vanggewas
  "nl_6754", // italiaans raaigras
  "nl_6755", // italiaans raaigras vanggewas
  "nl_6782", // rietzwenkgras
  "nl_6783", // rietzwenkgras vanggewas
  "nl_6784", // roodzwenkgras
  "nl_6785", // roodzwenkgras vanggewas
  "nl_6786", // timothee
  "nl_6787", // timothee vanggewas
  "nl_6788", // veldbeemdgras
  "nl_6789", // veldbeemdgras vanggewas
  "nl_6790", // westerwolds raaigras
  "nl_6791", // westerwolds raaigras vanggewas
  "nl_383", // graszaad overig
  "nl_1914", // graszaad overig
  "nl_6768", // graszaad overig
  "nl_1034", // graszaad overig
  "nl_1035", // graszaad overig
  "nl_7126", // overige gras vanggewas
  "nl_426", // overige groenbemesters vlinderbloemig
  "nl_427", // overige groenbemesters niet-vlinderbloemig
  "nl_428", // gele mosterd
  "nl_3502", // bladkool
  "nl_3503", // bladraap
  "nl_3504", // bladrammenas
  "nl_3505", // deder
  "nl_3507", // ethiopische mosterd
  "nl_3508", // facelia
  "nl_3514", // niger
  "nl_3517", // sarepta mosterd
  "nl_3518", // seradelle
  "nl_3519", // soedangras
  "nl_3520", // spurrie
  "nl_3521", // stoppelknollen
  "nl_2298", // groenbemesters vlinderbloemig
  "nl_2299", // groenbemesters niet-vlinderbloemig
  "nl_7125", // overige groenbemesters niet-vlinderbloemig
  "nl_6756", // alexandrijnse klaver vanggewas
  "nl_6757", // alexandrijnse klaver zaad
  "nl_6758", // incarnaatklaver vanggewas
  "nl_6759", // incarnaatklaver zaad
  "nl_6760", // perzische klaver vanggewas
  "nl_6761", // perzische klaver zaad
  "nl_6762", // rode klaver vanggewas
  "nl_6763", // rode klaver zaad
  "nl_6764", // witte klaver vanggewas
  "nl_6765", // witte klaver zaad
  "nl_6769", // overig klaverzaad
  "nl_800", // rolklaver
  "nl_801", // esparcette
  "nl_802", // bonte wikke
  "nl_803", // voederwikke

  // Arable & horticulture
  "nl_2017", // zetmeelaardappelen
  "nl_256", // suikerbieten (na 1-11 geoogst)
  "nl_257", // voederbieten (na 1-11 geoogst)
  "nl_511", // cichorei
  "nl_1023", // cichorei
  "nl_1024", // cichorei
  "nl_1036", // cichorei
  "nl_316", // mais korrel (met onderzaai)
  "nl_317", // mais corncob mix (met onderzaai)
  "nl_1935", // maiskolvensilage (met onderzaai)
  "nl_2032", // mais energie (met onderzaai)
  "nl_814", // mais suiker (met onderzaai)
  "nl_258", // luzerne
  "nl_663", // zoete lupine
  "nl_1926", // luzerne
  "nl_1949", // luzerne
  "nl_6660", // zaaiui / winterui
  "nl_6664", // zaaiui / winterui
  "nl_1932", // winterui 1e jaars
  "nl_1933", // winterui 2e jaars
  "nl_263", // ui overig
  "nl_1934", // ui overig
  "nl_1021", // ui overig
  "nl_7195", // ui overig
  "nl_7196", // ui overig
  "nl_246", // karwij
  "nl_1922", // koolzaad winter
  "nl_2652", // granen overig
  "nl_1927", // granen overig
  "nl_375", // hop
  "nl_516", // miscanthus
  "nl_2773", // spinazie
  "nl_2774", // spinazie
  "nl_1022", // spinazie volgteelt
  "nl_2767", // slasoorten
  "nl_2768", // slasoorten
  "nl_2769", // slasoorten
  "nl_2770", // slasoorten
  "nl_2771", // slasoorten
  "nl_2772", // slasoorten
  "nl_2766", // slasoorten
  "nl_2709", // andijvie
  "nl_2708", // andijvie
  "nl_2765", // selderij bleek/groen
  "nl_2749", // prei
  "nl_2750", // prei
  "nl_2799", // prei
  "nl_2800", // prei
  "nl_2801", // prei
  "nl_2802", // prei
  "nl_2777", // spruitkool
  "nl_2778", // spruitkool
  "nl_2789", // witte kool
  "nl_2790", // witte kool
  "nl_2759", // rode kool
  "nl_2760", // rode kool
  "nl_2761", // savooiekool
  "nl_2762", // savooiekool
  "nl_2775", // spitskool
  "nl_2776", // spitskool
  "nl_2795", // bloemkool winter productie
  "nl_2719", // broccoli
  "nl_2720", // broccoli
  "nl_2721", // chinese kool
  "nl_2722", // chinese kool
  "nl_2715", // boerenkool
  "nl_2716", // boerenkool
  "nl_2745", // paksoi
  "nl_2746", // paksoi
  "nl_2743", // kruiden
  "nl_2744", // kruiden
  "nl_1019", // kruiden
  "nl_1020", // kruiden
  "nl_1028", // kruiden
  "nl_1029", // kruiden
  "nl_1030", // kruiden
  "nl_1031", // kruiden
  "nl_1032", // kruiden
  "nl_1037", // kruiden
  "nl_1038", // kruiden
  "nl_654", // kruiden
  "nl_6749", // kruiden
  "nl_652", // kruiden
  "nl_655", // kruiden
  "nl_2700", // aardbei
  "nl_2701", // aardbei
  "nl_2702", // aardbei
  "nl_311", // winterveldbonen
  "nl_241", // erwt
  "nl_244", // erwt
  "nl_308", // erwt
  "nl_2710", // asperges
  "nl_2711", // asperges opkweek
  "nl_2712", // asperges zaden
  "nl_2725", // knolselderij
  "nl_2726", // knolselderij
  "nl_2727", // knolvenkel
  "nl_2728", // knolvenkel
  "nl_2737", // koolraap
  "nl_2738", // koolraap
  "nl_2739", // koolrabi
  "nl_2740", // koolrabi
  "nl_2741", // kroten/rode bieten
  "nl_2742", // kroten/rode bieten
  "nl_2783", // winterpeen
  "nl_2784", // winterpeen
  "nl_2785", // winterpeen
  "nl_2786", // winterpeen
  "nl_2755", // rabarber
  "nl_2756", // rabarber
  "nl_2763", // schorseneren
  "nl_2764", // schorseneren
  "nl_2787", // witlof
  "nl_2788", // witlof

  // Bulbs, fruit trees, tree nursery
  "nl_970",
  "nl_971",
  "nl_999",
  "nl_1016",
  "nl_1017",
  "nl_1018",
  "nl_973",
  "nl_974",
  "nl_1000",
  "nl_1051",
  "nl_1052",
  "nl_976",
  "nl_977",
  "nl_1001",
  "nl_982",
  "nl_983",
  "nl_1003",
  "nl_985",
  "nl_986",
  "nl_1004",
  "nl_964",
  "nl_965",
  "nl_997",
  "nl_979",
  "nl_980",
  "nl_1002",
  "nl_988",
  "nl_989",
  "nl_1005",
  "nl_176",
  "nl_994",
  "nl_995",
  "nl_1006",
  "nl_1007",
  "nl_1010",
  "nl_1011",
  "nl_1012",
  "nl_1013",
  "nl_1014",
  "nl_1015",
  "nl_1025",
  "nl_1026",
  "nl_1027",
  "nl_6795",
  "nl_6796",
  "nl_6797",
  "nl_6803",
  "nl_6804",
  "nl_6805",
  "nl_1095",
  "nl_1096",
  "nl_1869",
  "nl_1874",
  "nl_1047",
  "nl_2327",
  "nl_2326",
  "nl_1872",
  "nl_2328",
  "nl_1100",
  "nl_2645",
  "nl_7139",
  "nl_7193",
  "nl_7194",
  "nl_1097",
  "nl_1098",
  "nl_1870",
  "nl_2325",
  "nl_1099",
  "nl_1873",
  "nl_1054",
  "nl_174",
  "nl_636",
  "nl_637",
  "nl_653",
  "nl_656",
  "nl_657",
  "nl_991",
  "nl_992",
  "nl_1039",
  "nl_1040",
  "nl_1042",
  "nl_1043",
  "nl_1044",
  "nl_1045",
  "nl_1046",
  "nl_1048",
  "nl_1049",
  "nl_1050",
  "nl_1055",
  "nl_1070",
  "nl_1071",
  "nl_1072",
  "nl_1075",
  "nl_796",
  "nl_1074",
  "nl_1073",
  "nl_1067",
  "nl_863",
  "nl_1080",
  "nl_1078",
  "nl_1077",
  "nl_1079",
  "nl_1076",
  "nl_1876",
  "nl_1069",
  "nl_1068",
  "nl_864",
  "nl_7136",
  "nl_7197",
])
