import type { BcsIndicatorKey } from "~/components/blocks/soil-visual/bcs-color-utils"

interface ScoreLevel {
    score: 0 | 1 | 2
    label: string
    description: string
    referenceImageUrl?: string
}

export interface IndicatorScoringGuide {
    key: BcsIndicatorKey
    instruction: string
    scoreLevels: ScoreLevel[]
}

/**
 * Scoring criteria per BCS indicator, derived from the official protocol documents
 * (WUR/Boerenverstand/Louis Bolk "MijnBodemconditie" methodology).
 *
 * Each indicator has:
 * - instruction: what to do in the field
 * - scoreLevels: what 0/1/2 means with descriptions
 * - optional referenceImageUrl: can be added later as static assets
 */
export const BCS_SCORING_GUIDE: IndicatorScoringGuide[] = [
    {
        key: "a_cc_bcs",
        instruction:
            "Beoordeel het percentage bodemoppervlak dat bedekt is door vegetatie. Kijk van bovenaf naar het perceel.",
        scoreLevels: [
            {
                score: 2,
                label: "Goed",
                description: ">75% van het bodemoppervlak bedekt door vegetatie",
            },
            {
                score: 1,
                label: "Matig",
                description: "~50% van het bodemoppervlak bedekt",
            },
            {
                score: 0,
                label: "Onvoldoende",
                description: "<20% van het bodemoppervlak bedekt",
            },
        ],
    },
    {
        key: "a_rd_bcs",
        instruction:
            "Bekijk de beworteling in het uitgegraven blok. Beoordeel de maximale wortelgroei-diepte, verdeling en vertakking.",
        scoreLevels: [
            {
                score: 2,
                label: "Goed",
                description:
                    "Maximale wortelgroei tot 50 cm, goed regelmatig over het hele profiel. Fijne vertakkingen zichtbaar.",
            },
            {
                score: 1,
                label: "Matig",
                description:
                    "Maximale wortelgroei tot 30 cm, onregelmatige verdeling. Beperkte vertakking.",
            },
            {
                score: 0,
                label: "Onvoldoende",
                description:
                    "Maximale wortelgroei slechts 20 cm. Zeer beperkte of geen fijne wortels.",
            },
        ],
    },
    {
        key: "a_sc_bcs",
        instruction:
            "Graaf de kuil tot 40-50 cm diepte. Snij de bodem van boven naar beneden met een spatel. Voel of er weerstandsverschillen zijn (ploegzool).",
        scoreLevels: [
            {
                score: 2,
                label: "Goed",
                description:
                    "Geen weerstandsverschillen voelbaar. Poriën aanwezig in alle dieptes. Goede wortelgroei door hele profiel.",
            },
            {
                score: 1,
                label: "Matig",
                description:
                    "Matig weerstandsverschil voelbaar. Poriën aanwezig. Kleurverschil tussen lagen zichtbaar.",
            },
            {
                score: 0,
                label: "Onvoldoende",
                description:
                    "Groot contrast in weerstand voelbaar. Duidelijke ploegzool zichtbaar. Wortels stoppen of worden blauw.",
            },
        ],
    },
    {
        key: "a_ew_bcs",
        instruction:
            "Breek het uitgegraven blok open in kleinere stukjes. Tel de regenwormen en bepaal hoeveel soorten (strooiselbewoners=rood, bodembewoners=grauw, pendelaars=rood/roze).",
        scoreLevels: [
            {
                score: 2,
                label: "Goed",
                description:
                    "Meer dan 6 regenwormen gevonden met minimaal 3 soorten.",
            },
            {
                score: 1,
                label: "Matig",
                description: "3 tot 6 regenwormen met 2 soorten.",
            },
            {
                score: 0,
                label: "Onvoldoende",
                description: "Minder dan 3 regenwormen, slechts 1 soort.",
            },
        ],
    },
    {
        key: "a_ss_bcs",
        instruction:
            "Laat het uitgegraven blok 3× vallen vanuit circa 1 meter hoogte op een plastic zak. Sorteer de aggregaten: grootste bovenaan, kleinste onderaan. Vergelijk met referentiebeelden.",
        scoreLevels: [
            {
                score: 2,
                label: "Goed",
                description:
                    "Overwegend kleine, kruimelige aggregaten. Bodem valt gemakkelijk uit elkaar in stabiele kruimels.",
            },
            {
                score: 1,
                label: "Matig",
                description:
                    "Mix van grote en kleine aggregaten. Enige plattige kluiten aanwezig.",
            },
            {
                score: 0,
                label: "Onvoldoende",
                description:
                    "Vooral grote, plattige kluiten. Bodem breekt niet of nauwelijks op. Geen kruimelstructuur.",
            },
        ],
    },
    {
        key: "a_ph_bcs",
        instruction:
            "Gebruik de pH-CaCl₂ waarde uit het bodemonderzoek. Vergelijk met de optimale range voor uw grondsoort en gewas.",
        scoreLevels: [
            {
                score: 2,
                label: "Goed",
                description: "pH binnen optimaal bereik voor grondsoort en gewas.",
            },
            {
                score: 1,
                label: "Matig",
                description: "pH net buiten optimaal bereik (suboptimaal).",
            },
            {
                score: 0,
                label: "Onvoldoende",
                description: "pH ver buiten optimaal bereik.",
            },
        ],
    },
    {
        key: "a_som_bcs",
        instruction:
            "Gebruik het organische stofgehalte (%) uit het bodemonderzoek. Vergelijk met normen voor uw grondsoort en landgebruik.",
        scoreLevels: [
            {
                score: 2,
                label: "Goed",
                description:
                    "Organische stofgehalte boven de 70e percentiel voor grondsoort/gewas.",
            },
            {
                score: 1,
                label: "Matig",
                description:
                    "Organische stofgehalte tussen de 30e en 70e percentiel.",
            },
            {
                score: 0,
                label: "Onvoldoende",
                description: "Organische stofgehalte onder de 30e percentiel.",
            },
        ],
    },
    {
        key: "a_gs_bcs",
        instruction:
            "Bekijk het profiel op gekleurde vlekken (roest/oranje, blauw/grijs). Deze duiden op afwisselend natte en droge omstandigheden (redox).",
        scoreLevels: [
            {
                score: 2,
                label: "Goed",
                description: "Minder dan 5% van het oppervlak vertoont vlekken.",
            },
            {
                score: 1,
                label: "Matig",
                description: "5-20% van het oppervlak vertoont vlekken.",
            },
            {
                score: 0,
                label: "Onvoldoende",
                description: "Meer dan 20% van het oppervlak vertoont vlekken.",
            },
        ],
    },
    {
        key: "a_p_bcs",
        instruction:
            "Beoordeel of er waterplassen op het perceel aanwezig zijn. Dit is een negatieve indicator (hogere score = slechter).",
        scoreLevels: [
            {
                score: 0,
                label: "Geen",
                description: "Geen plasvorming zichtbaar op het perceel.",
            },
            {
                score: 1,
                label: "Matig",
                description: "Enkele plassen aanwezig, beperkt oppervlak.",
            },
            {
                score: 2,
                label: "Veel",
                description:
                    "Veel plassen, grote delen van het perceel staan onder water.",
            },
        ],
    },
    {
        key: "a_c_bcs",
        instruction:
            "Beoordeel of er scheuren zichtbaar zijn in de bovenste laag van de bodem. Dit is een negatieve indicator.",
        scoreLevels: [
            {
                score: 0,
                label: "Geen",
                description: "Geen zichtbare scheuren in de toplaag.",
            },
            {
                score: 1,
                label: "Matig",
                description: "Enkele scheuren aanwezig, beperkte breedte/diepte.",
            },
            {
                score: 2,
                label: "Veel",
                description:
                    "Veel en/of diepe scheuren in de toplaag. Bodem droogt sterk uit.",
            },
        ],
    },
    {
        key: "a_rt_bcs",
        instruction:
            "Beoordeel of er wielsporen, hoefafdrukken of vertrapping zichtbaar is op het perceel. Dit is een negatieve indicator.",
        scoreLevels: [
            {
                score: 0,
                label: "Geen",
                description: "Geen spoorvorming of vertrapping zichtbaar.",
            },
            {
                score: 1,
                label: "Matig",
                description: "Enkele sporen of matige vertrapping.",
            },
            {
                score: 2,
                label: "Veel",
                description:
                    "Veel en diepe wielsporen of ernstige vertrapping over groot deel van perceel.",
            },
        ],
    },
]

/** Look up scoring guide for a specific indicator */
export function getScoringGuide(key: BcsIndicatorKey): IndicatorScoringGuide | undefined {
    return BCS_SCORING_GUIDE.find((g) => g.key === key)
}
