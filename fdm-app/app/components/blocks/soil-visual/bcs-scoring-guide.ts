import type { BcsIndicatorKey } from "~/lib/bcs"

export interface ScoringCriteria {
    score: 0 | 1 | 2
    label: string
    description: string
}

export interface IndicatorGuide {
    key: BcsIndicatorKey
    name: string
    description: string
    instructions: string
    criteria: ScoringCriteria[]
    tip: string
}

export const BCS_GUIDES: IndicatorGuide[] = [
    {
        key: "a_cc_bcs",
        name: "Gewasbedekking",
        description:
            "Hoeveel van het bodemoppervlak bedekt is met een levend gewas of plantenresten.",
        instructions:
            "Kijk recht van boven naar het perceel en schat welk deel van de bodem niet meer zichtbaar is.",
        criteria: [
            {
                score: 0,
                label: "Slecht",
                description:
                    "Minder dan 30% van de bodem is bedekt; grote delen liggen kaal.",
            },
            {
                score: 1,
                label: "Matig",
                description:
                    "Ongeveer 30% tot 70% van het oppervlak is bedekt.",
            },
            {
                score: 2,
                label: "Goed",
                description:
                    "Meer dan 70% van de bodem is bedekt door vegetatie of resten.",
            },
        ],
        tip: "Maak een overzichtsfoto recht van boven zodat de bedekking goed zichtbaar is.",
    },
    {
        key: "a_rd_bcs",
        name: "Beworteling",
        description:
            "De diepte, dichtheid en vertakking van wortels in de profielwand en het bodemblok.",
        instructions:
            "Bekijk de profielwand en breek een kluit open. Let op hoe diep de wortels gaan en hoe gelijkmatig ze verdeeld zijn.",
        criteria: [
            {
                score: 0,
                label: "Slecht",
                description:
                    "Wortels zijn oppervlakkig, schaars en vooral in de bovenlaag aanwezig.",
            },
            {
                score: 1,
                label: "Matig",
                description:
                    "Wortels komen tot middelmatige diepte en zijn redelijk verdeeld.",
            },
            {
                score: 2,
                label: "Goed",
                description:
                    "Wortels gaan diep door en zijn fijn vertakt en dicht aanwezig.",
            },
        ],
        tip: "Fotografeer een schone profielwand of opengebroken kluit met duidelijk zichtbare wortels.",
    },
    {
        key: "a_sc_bcs",
        name: "Verdichting ondergrond",
        description:
            "Mate van verdichting, plaatstructuren en doorwortelbaarheid in de ondergrond.",
        instructions:
            "Voel in de ondergrond met een spade of hand aan de weerstand en let op platte structuren of dichte lagen.",
        criteria: [
            {
                score: 0,
                label: "Slecht",
                description:
                    "De ondergrond is sterk verdicht, hard en toont duidelijke plaatstructuren.",
            },
            {
                score: 1,
                label: "Matig",
                description:
                    "Er is enige verdichting zichtbaar, maar nog wel enige kruimeligheid aanwezig.",
            },
            {
                score: 2,
                label: "Goed",
                description:
                    "Geen duidelijke verdichting; de ondergrond is kruimelig en goed doorwortelbaar.",
            },
        ],
        tip: "Leg een detail vast van de ondergrond waar plaatjes of juist kruimels goed zichtbaar zijn.",
    },
    {
        key: "a_ew_bcs",
        name: "Regenwormen",
        description:
            "Aantal regenwormen in een steekproef van circa 20 x 20 x 20 cm.",
        instructions:
            "Tel alle regenwormen in een uitgegraven bodemblok van ongeveer 20 centimeter diep, breed en lang.",
        criteria: [
            {
                score: 0,
                label: "Slecht",
                description:
                    "Er zijn 0 tot 2 regenwormen gevonden in het bodemblok.",
            },
            {
                score: 1,
                label: "Matig",
                description: "Er zijn 3 tot 5 regenwormen gevonden.",
            },
            {
                score: 2,
                label: "Goed",
                description: "Er zijn meer dan 5 regenwormen gevonden.",
            },
        ],
        tip: "Maak een close-up van het uitgegraven bodemblok of leg de wormen naast een meetlat vast.",
    },
    {
        key: "a_ss_bcs",
        name: "Bodemstructuur",
        description:
            "Grootte en stevigheid van kluiten en de stabiliteit van aggregaten.",
        instructions:
            "Neem een bodemblok in de hand en beoordeel hoe makkelijk het uiteenvalt in kruimels of harde kluiten.",
        criteria: [
            {
                score: 0,
                label: "Slecht",
                description:
                    "Grote, harde kluiten die moeilijk breken en weinig kruimels geven.",
            },
            {
                score: 1,
                label: "Matig",
                description:
                    "Middelgrote kluiten met zowel kruimels als enkele stevige delen.",
            },
            {
                score: 2,
                label: "Goed",
                description:
                    "Kleine, kruimelige aggregaten die gemakkelijk uiteen vallen.",
            },
        ],
        tip: "Fotografeer een opengebroken bodemblok van dichtbij zodat de aggregaten goed zichtbaar zijn.",
    },
    {
        key: "a_gs_bcs",
        name: "Gekleurde vlekken",
        description:
            "Roest-, blauwe of grijze vlekken die wijzen op langdurige natte omstandigheden.",
        instructions:
            "Inspecteer de profielwand op verkleuringen en bepaal hoeveel van deze vlekken aanwezig zijn.",
        criteria: [
            {
                score: 0,
                label: "Slecht",
                description:
                    "Veel gekleurde vlekken aanwezig; duidelijke sporen van wateroverlast.",
            },
            {
                score: 1,
                label: "Matig",
                description:
                    "Enkele gekleurde vlekken zichtbaar in de profielwand.",
            },
            {
                score: 2,
                label: "Goed",
                description:
                    "Geen of vrijwel geen gekleurde vlekken zichtbaar.",
            },
        ],
        tip: "Maak een scherpe foto van de profielwand bij egaal daglicht om kleurverschillen zichtbaar te maken.",
    },
    {
        key: "a_p_bcs",
        name: "Plasvorming",
        description:
            "Hoe vaak water op het oppervlak blijft staan na neerslag.",
        instructions:
            "Kijk op het perceel naar stilstaand water, natte plekken en sporen van recente plasvorming.",
        criteria: [
            {
                score: 0,
                label: "Geen",
                description: "Geen of nauwelijks plasvorming zichtbaar.",
            },
            {
                score: 1,
                label: "Enig",
                description:
                    "Op meerdere plekken is enige plasvorming zichtbaar.",
            },
            {
                score: 2,
                label: "Veel",
                description:
                    "Regelmatig of veel plasvorming op het bodemoppervlak.",
            },
        ],
        tip: "Gebruik een overzichtsfoto waarop natte plekken en de omvang van de plasvorming duidelijk te zien zijn.",
    },
    {
        key: "a_c_bcs",
        name: "Scheuren",
        description:
            "Mate waarin de toplaag open is gescheurd door uitdroging of structuurproblemen.",
        instructions:
            "Beoordeel het bodemoppervlak op zichtbare scheuren en let op diepte en dichtheid van het patroon.",
        criteria: [
            {
                score: 0,
                label: "Geen",
                description: "Geen zichtbare scheuren in het bodemoppervlak.",
            },
            {
                score: 1,
                label: "Enig",
                description: "Enkele zichtbare scheuren aanwezig.",
            },
            {
                score: 2,
                label: "Veel",
                description:
                    "Veel of diepe scheuren over een groot deel van het oppervlak.",
            },
        ],
        tip: "Fotografeer schuin over het oppervlak zodat diepte en lengte van scheuren beter zichtbaar zijn.",
    },
    {
        key: "a_rt_bcs",
        name: "Spoorvorming",
        description:
            "Wielsporen, hoefafdrukken of andere indrukkingen aan het oppervlak.",
        instructions:
            "Loop over het perceel en beoordeel hoe diep en hoe ernstig de sporen of vertrapping zijn.",
        criteria: [
            {
                score: 0,
                label: "Geen",
                description: "Geen zichtbare sporen of vertrapping.",
            },
            {
                score: 1,
                label: "Enig",
                description: "Ondiepe of plaatselijke sporen zichtbaar.",
            },
            {
                score: 2,
                label: "Veel",
                description:
                    "Diepe of ernstige spoorvorming of vertrapping aanwezig.",
            },
        ],
        tip: "Neem een foto vanuit de lengte van het spoor zodat diepte en breedte goed zichtbaar worden.",
    },
]
