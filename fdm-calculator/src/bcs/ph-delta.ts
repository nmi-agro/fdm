/**
 * Calculates the difference between measured soil pH and the optimal pH.
 *
 * Ports the OBIC `calc_ph_delta` function from R.
 * Reference: Handboek Bodem en Bemesting, tables 5.1, 5.2, 5.3
 * Source: https://github.com/nmi-agro/Open-Bodem-Index-Calculator/blob/master/R/ph.R
 */

/** fdm-core b_soiltype_agr values */
export type SoiltypeAgr =
    | "dekzand"
    | "dalgrond"
    | "duinzand"
    | "loess"
    | "maasklei"
    | "moerige_klei"
    | "rivierklei"
    | "veen"
    | "zeeklei"

/** OBIC soiltype.ph classification: 1 = sandy/peat (tables 5.1/5.2), 2 = clay/loess (table 5.3) */
const SOILTYPE_PH: Record<SoiltypeAgr, 1 | 2> = {
    dekzand: 1,
    dalgrond: 1,
    duinzand: 1,
    veen: 1,
    zeeklei: 2,
    rivierklei: 2,
    maasklei: 2,
    moerige_klei: 2,
    loess: 2,
}

interface PhRow {
    omLow: number
    omHigh: number
    phOptimum: number
    lutumLow?: number
    lutumHigh?: number
    potatoLow?: number
    potatoHigh?: number
    sugarbeetLow?: number
    sugarbeetHigh?: number
}

/** Table 5.3 — clay/loess soils (soiltype.ph == 2), 84 rows, Handboek Bodem en Bemesting */
const TABLE_5_3: PhRow[] = [
    { lutumLow: 0, lutumHigh: 8, omLow: 0, omHigh: 2, phOptimum: 6.7 },
    { lutumLow: 0, lutumHigh: 8, omLow: 2, omHigh: 3, phOptimum: 6.3 },
    { lutumLow: 0, lutumHigh: 8, omLow: 3, omHigh: 5, phOptimum: 6.0 },
    { lutumLow: 0, lutumHigh: 8, omLow: 5, omHigh: 7.5, phOptimum: 5.7 },
    { lutumLow: 0, lutumHigh: 8, omLow: 7.5, omHigh: 10, phOptimum: 5.5 },
    { lutumLow: 0, lutumHigh: 8, omLow: 10, omHigh: 12.5, phOptimum: 5.4 },
    { lutumLow: 0, lutumHigh: 8, omLow: 12.5, omHigh: 15, phOptimum: 5.2 },
    { lutumLow: 0, lutumHigh: 8, omLow: 15, omHigh: 20, phOptimum: 5.0 },
    { lutumLow: 0, lutumHigh: 8, omLow: 20, omHigh: 25, phOptimum: 4.8 },
    { lutumLow: 0, lutumHigh: 8, omLow: 25, omHigh: 30, phOptimum: 4.6 },
    { lutumLow: 0, lutumHigh: 8, omLow: 30, omHigh: 35, phOptimum: 4.4 },
    { lutumLow: 0, lutumHigh: 8, omLow: 35, omHigh: 101, phOptimum: 4.2 },
    { lutumLow: 8, lutumHigh: 12, omLow: 0, omHigh: 2, phOptimum: 6.7 },
    { lutumLow: 8, lutumHigh: 12, omLow: 2, omHigh: 3, phOptimum: 6.4 },
    { lutumLow: 8, lutumHigh: 12, omLow: 3, omHigh: 5, phOptimum: 6.1 },
    { lutumLow: 8, lutumHigh: 12, omLow: 5, omHigh: 7.5, phOptimum: 5.9 },
    { lutumLow: 8, lutumHigh: 12, omLow: 7.5, omHigh: 10, phOptimum: 5.7 },
    { lutumLow: 8, lutumHigh: 12, omLow: 10, omHigh: 12.5, phOptimum: 5.5 },
    { lutumLow: 8, lutumHigh: 12, omLow: 12.5, omHigh: 15, phOptimum: 5.4 },
    { lutumLow: 8, lutumHigh: 12, omLow: 15, omHigh: 20, phOptimum: 5.2 },
    { lutumLow: 8, lutumHigh: 12, omLow: 20, omHigh: 25, phOptimum: 5.0 },
    { lutumLow: 8, lutumHigh: 12, omLow: 25, omHigh: 30, phOptimum: 4.8 },
    { lutumLow: 8, lutumHigh: 12, omLow: 30, omHigh: 35, phOptimum: 4.6 },
    { lutumLow: 8, lutumHigh: 12, omLow: 35, omHigh: 101, phOptimum: 4.3 },
    { lutumLow: 12, lutumHigh: 18, omLow: 0, omHigh: 2, phOptimum: 6.7 },
    { lutumLow: 12, lutumHigh: 18, omLow: 2, omHigh: 3, phOptimum: 6.5 },
    { lutumLow: 12, lutumHigh: 18, omLow: 3, omHigh: 5, phOptimum: 6.3 },
    { lutumLow: 12, lutumHigh: 18, omLow: 5, omHigh: 7.5, phOptimum: 6.1 },
    { lutumLow: 12, lutumHigh: 18, omLow: 7.5, omHigh: 10, phOptimum: 5.9 },
    { lutumLow: 12, lutumHigh: 18, omLow: 10, omHigh: 12.5, phOptimum: 5.7 },
    { lutumLow: 12, lutumHigh: 18, omLow: 12.5, omHigh: 15, phOptimum: 5.5 },
    { lutumLow: 12, lutumHigh: 18, omLow: 15, omHigh: 20, phOptimum: 5.4 },
    { lutumLow: 12, lutumHigh: 18, omLow: 20, omHigh: 25, phOptimum: 5.1 },
    { lutumLow: 12, lutumHigh: 18, omLow: 25, omHigh: 30, phOptimum: 4.9 },
    { lutumLow: 12, lutumHigh: 18, omLow: 30, omHigh: 35, phOptimum: 4.7 },
    { lutumLow: 12, lutumHigh: 18, omLow: 35, omHigh: 101, phOptimum: 4.4 },
    { lutumLow: 18, lutumHigh: 25, omLow: 0, omHigh: 2, phOptimum: 6.8 },
    { lutumLow: 18, lutumHigh: 25, omLow: 2, omHigh: 3, phOptimum: 6.7 },
    { lutumLow: 18, lutumHigh: 25, omLow: 3, omHigh: 5, phOptimum: 6.5 },
    { lutumLow: 18, lutumHigh: 25, omLow: 5, omHigh: 7.5, phOptimum: 6.3 },
    { lutumLow: 18, lutumHigh: 25, omLow: 7.5, omHigh: 10, phOptimum: 6.1 },
    { lutumLow: 18, lutumHigh: 25, omLow: 10, omHigh: 12.5, phOptimum: 5.9 },
    { lutumLow: 18, lutumHigh: 25, omLow: 12.5, omHigh: 15, phOptimum: 5.7 },
    { lutumLow: 18, lutumHigh: 25, omLow: 15, omHigh: 20, phOptimum: 5.4 },
    { lutumLow: 18, lutumHigh: 25, omLow: 20, omHigh: 25, phOptimum: 5.2 },
    { lutumLow: 18, lutumHigh: 25, omLow: 25, omHigh: 30, phOptimum: 5.0 },
    { lutumLow: 18, lutumHigh: 25, omLow: 30, omHigh: 35, phOptimum: 4.8 },
    { lutumLow: 18, lutumHigh: 25, omLow: 35, omHigh: 101, phOptimum: 4.5 },
    { lutumLow: 25, lutumHigh: 30, omLow: 0, omHigh: 2, phOptimum: 7.1 },
    { lutumLow: 25, lutumHigh: 30, omLow: 2, omHigh: 3, phOptimum: 6.9 },
    { lutumLow: 25, lutumHigh: 30, omLow: 3, omHigh: 5, phOptimum: 6.7 },
    { lutumLow: 25, lutumHigh: 30, omLow: 5, omHigh: 7.5, phOptimum: 6.6 },
    { lutumLow: 25, lutumHigh: 30, omLow: 7.5, omHigh: 10, phOptimum: 6.4 },
    { lutumLow: 25, lutumHigh: 30, omLow: 10, omHigh: 12.5, phOptimum: 6.1 },
    { lutumLow: 25, lutumHigh: 30, omLow: 12.5, omHigh: 15, phOptimum: 5.9 },
    { lutumLow: 25, lutumHigh: 30, omLow: 15, omHigh: 20, phOptimum: 5.6 },
    { lutumLow: 25, lutumHigh: 30, omLow: 20, omHigh: 25, phOptimum: 5.4 },
    { lutumLow: 25, lutumHigh: 30, omLow: 25, omHigh: 30, phOptimum: 5.1 },
    { lutumLow: 25, lutumHigh: 30, omLow: 30, omHigh: 35, phOptimum: 4.9 },
    { lutumLow: 25, lutumHigh: 30, omLow: 35, omHigh: 101, phOptimum: 4.6 },
    { lutumLow: 30, lutumHigh: 35, omLow: 0, omHigh: 2, phOptimum: 7.2 },
    { lutumLow: 30, lutumHigh: 35, omLow: 2, omHigh: 3, phOptimum: 7.1 },
    { lutumLow: 30, lutumHigh: 35, omLow: 3, omHigh: 5, phOptimum: 7.0 },
    { lutumLow: 30, lutumHigh: 35, omLow: 5, omHigh: 7.5, phOptimum: 6.7 },
    { lutumLow: 30, lutumHigh: 35, omLow: 7.5, omHigh: 10, phOptimum: 6.6 },
    { lutumLow: 30, lutumHigh: 35, omLow: 10, omHigh: 12.5, phOptimum: 6.3 },
    { lutumLow: 30, lutumHigh: 35, omLow: 12.5, omHigh: 15, phOptimum: 6.1 },
    { lutumLow: 30, lutumHigh: 35, omLow: 15, omHigh: 20, phOptimum: 5.8 },
    { lutumLow: 30, lutumHigh: 35, omLow: 20, omHigh: 25, phOptimum: 5.5 },
    { lutumLow: 30, lutumHigh: 35, omLow: 25, omHigh: 30, phOptimum: 5.3 },
    { lutumLow: 30, lutumHigh: 35, omLow: 30, omHigh: 35, phOptimum: 5.0 },
    { lutumLow: 30, lutumHigh: 35, omLow: 35, omHigh: 101, phOptimum: 4.7 },
    { lutumLow: 35, lutumHigh: 101, omLow: 0, omHigh: 2, phOptimum: 7.2 },
    { lutumLow: 35, lutumHigh: 101, omLow: 2, omHigh: 3, phOptimum: 7.2 },
    { lutumLow: 35, lutumHigh: 101, omLow: 3, omHigh: 5, phOptimum: 7.1 },
    { lutumLow: 35, lutumHigh: 101, omLow: 5, omHigh: 7.5, phOptimum: 6.9 },
    { lutumLow: 35, lutumHigh: 101, omLow: 7.5, omHigh: 10, phOptimum: 6.7 },
    { lutumLow: 35, lutumHigh: 101, omLow: 10, omHigh: 12.5, phOptimum: 6.5 },
    { lutumLow: 35, lutumHigh: 101, omLow: 12.5, omHigh: 15, phOptimum: 6.2 },
    { lutumLow: 35, lutumHigh: 101, omLow: 15, omHigh: 20, phOptimum: 5.9 },
    { lutumLow: 35, lutumHigh: 101, omLow: 20, omHigh: 25, phOptimum: 5.6 },
    { lutumLow: 35, lutumHigh: 101, omLow: 25, omHigh: 30, phOptimum: 5.4 },
    { lutumLow: 35, lutumHigh: 101, omLow: 30, omHigh: 35, phOptimum: 5.1 },
    { lutumLow: 35, lutumHigh: 101, omLow: 35, omHigh: 101, phOptimum: 4.8 },
]

/** Table 5.1 — sandy/peat soils without starch potatoes, 20 rows, Handboek Bodem en Bemesting */
const TABLE_5_1: PhRow[] = [
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0.45,
        potatoHigh: 1.01,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.3,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0.45,
        potatoHigh: 1.01,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.1,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0.45,
        potatoHigh: 1.01,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 4.9,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0.45,
        potatoHigh: 1.01,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 4.8,
    },
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0.05,
        potatoHigh: 0.45,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.4,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0.05,
        potatoHigh: 0.45,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.3,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0.05,
        potatoHigh: 0.45,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.2,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0.05,
        potatoHigh: 0.45,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.0,
    },
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0.3,
        potatoHigh: 1.01,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.7,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0.3,
        potatoHigh: 1.01,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.5,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0.3,
        potatoHigh: 1.01,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.4,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0.3,
        potatoHigh: 1.01,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.3,
    },
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0.05,
        potatoHigh: 0.3,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.8,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0.05,
        potatoHigh: 0.3,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.8,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0.05,
        potatoHigh: 0.3,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.7,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0.05,
        potatoHigh: 0.3,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.5,
    },
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0,
        potatoHigh: 0.05,
        sugarbeetLow: 0,
        sugarbeetHigh: 1.01,
        phOptimum: 5.4,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0,
        potatoHigh: 0.05,
        sugarbeetLow: 0,
        sugarbeetHigh: 1.01,
        phOptimum: 5.3,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0,
        potatoHigh: 0.05,
        sugarbeetLow: 0,
        sugarbeetHigh: 1.01,
        phOptimum: 5.2,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0,
        potatoHigh: 0.05,
        sugarbeetLow: 0,
        sugarbeetHigh: 1.01,
        phOptimum: 5.0,
    },
]

/** Table 5.2 — sandy/peat soils with starch potatoes (D_CP_STARCH > 0.1), 28 rows, Handboek Bodem en Bemesting */
const TABLE_5_2: PhRow[] = [
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0.35,
        potatoHigh: 1.01,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.4,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0.35,
        potatoHigh: 1.01,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.2,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0.35,
        potatoHigh: 1.01,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.1,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0.35,
        potatoHigh: 1.01,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.0,
    },
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0,
        potatoHigh: 0.35,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.6,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0,
        potatoHigh: 0.35,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.4,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0,
        potatoHigh: 0.35,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.4,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0,
        potatoHigh: 0.35,
        sugarbeetLow: 0,
        sugarbeetHigh: 0.1,
        phOptimum: 5.2,
    },
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0,
        potatoHigh: 0.35,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 0.22,
        phOptimum: 5.8,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0,
        potatoHigh: 0.35,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 0.22,
        phOptimum: 5.7,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0,
        potatoHigh: 0.35,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 0.22,
        phOptimum: 5.6,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0,
        potatoHigh: 0.35,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 0.22,
        phOptimum: 5.4,
    },
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0,
        potatoHigh: 0.22,
        sugarbeetLow: 0.22,
        sugarbeetHigh: 1.01,
        phOptimum: 5.8,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0,
        potatoHigh: 0.22,
        sugarbeetLow: 0.22,
        sugarbeetHigh: 1.01,
        phOptimum: 5.8,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0,
        potatoHigh: 0.22,
        sugarbeetLow: 0.22,
        sugarbeetHigh: 1.01,
        phOptimum: 5.7,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0,
        potatoHigh: 0.22,
        sugarbeetLow: 0.22,
        sugarbeetHigh: 1.01,
        phOptimum: 5.6,
    },
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0.22,
        potatoHigh: 0.35,
        sugarbeetLow: 0.22,
        sugarbeetHigh: 1.01,
        phOptimum: 5.7,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0.22,
        potatoHigh: 0.35,
        sugarbeetLow: 0.22,
        sugarbeetHigh: 1.01,
        phOptimum: 5.5,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0.22,
        potatoHigh: 0.35,
        sugarbeetLow: 0.22,
        sugarbeetHigh: 1.01,
        phOptimum: 5.4,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0.22,
        potatoHigh: 0.35,
        sugarbeetLow: 0.22,
        sugarbeetHigh: 1.01,
        phOptimum: 5.3,
    },
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0.35,
        potatoHigh: 0.45,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.7,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0.35,
        potatoHigh: 0.45,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.5,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0.35,
        potatoHigh: 0.45,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.4,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0.35,
        potatoHigh: 0.45,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.3,
    },
    {
        omLow: 0,
        omHigh: 5,
        potatoLow: 0.45,
        potatoHigh: 1.01,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.5,
    },
    {
        omLow: 5,
        omHigh: 8,
        potatoLow: 0.45,
        potatoHigh: 1.01,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.4,
    },
    {
        omLow: 8,
        omHigh: 15,
        potatoLow: 0.45,
        potatoHigh: 1.01,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.3,
    },
    {
        omLow: 15,
        omHigh: 101,
        potatoLow: 0.45,
        potatoHigh: 1.01,
        sugarbeetLow: 0.1,
        sugarbeetHigh: 1.01,
        phOptimum: 5.2,
    },
]

/** Table mh — grassland/dairy farming, 2 rows */
const TABLE_MH: PhRow[] = [
    { omLow: 0, omHigh: 25, phOptimum: 5.31 },
    { omLow: 25, omHigh: 101, phOptimum: 5.08 },
]

/** Table mh_kl — grassland with clover, 2 rows */
const TABLE_MH_KL: PhRow[] = [
    { omLow: 0, omHigh: 25, phOptimum: 5.81 },
    { omLow: 25, omHigh: 101, phOptimum: 5.58 },
]

export interface CalcPhDeltaParams {
    /** Soil type (fdm-core b_soiltype_agr) */
    b_soiltype_agr: SoiltypeAgr
    /** Organic matter content (%) */
    a_som_loi: number
    /** Clay content (%) — required for clay/loess soils (zeeklei, rivierklei, maasklei, moerige_klei, loess) */
    a_clay_mi: number
    /** Measured pH-CaCl₂ */
    a_ph_cc: number
    /** Fraction of starch potatoes in crop plan (0–1) */
    d_cp_starch: number
    /** Fraction of potatoes (excluding starch) in crop plan (0–1) */
    d_cp_potato: number
    /** Fraction of sugar beets in crop plan (0–1) */
    d_cp_sugarbeet: number
    /** Fraction of grass in crop plan (0–1) */
    d_cp_grass: number
    /** Fraction of maize in crop plan (0–1) */
    d_cp_mais: number
    /** Whether the current crop contains clover (affects grassland pH target) */
    b_lu_is_clover?: boolean
}

/**
 * Calculates D_PH_DELTA: the difference between the optimal and measured soil pH.
 *
 * Ports the OBIC `calc_ph_delta` function from R using embedded lookup tables from
 * Handboek Bodem en Bemesting (tables 5.1, 5.2, 5.3).
 *
 * Returns null if no matching row is found in the lookup table (e.g. out-of-range inputs).
 *
 * Source: https://github.com/nmi-agro/Open-Bodem-Index-Calculator/blob/master/R/ph.R
 */
export function calcPhDelta(params: CalcPhDeltaParams): number | null {
    const {
        b_soiltype_agr,
        a_som_loi,
        a_clay_mi,
        a_ph_cc,
        d_cp_starch,
        d_cp_potato,
        d_cp_sugarbeet,
        d_cp_grass,
        d_cp_mais,
        b_lu_is_clover = false,
    } = params

    // Combined potato fraction (starch + regular) for table lookup
    const combinedPotato = d_cp_starch + d_cp_potato

    // Table selection logic (mirrors OBIC R code)
    let table: "5.1" | "5.2" | "5.3" | "mh" | "mh_kl"
    const soiltypePh = SOILTYPE_PH[b_soiltype_agr]
    if (soiltypePh === undefined) return null
    table = soiltypePh === 1 ? "5.1" : "5.3"

    if (d_cp_starch > 0.1) table = "5.2"
    if (d_cp_grass + d_cp_mais >= 0.5) table = b_lu_is_clover ? "mh_kl" : "mh"

    let phOptimum: number | undefined

    if (table === "5.3") {
        const row = TABLE_5_3.find(
            (r) =>
                r.lutumLow! <= a_clay_mi &&
                a_clay_mi < r.lutumHigh! &&
                r.omLow <= a_som_loi &&
                a_som_loi < r.omHigh,
        )
        phOptimum = row?.phOptimum
    } else if (table === "5.1") {
        const row = TABLE_5_1.find(
            (r) =>
                r.potatoLow! <= combinedPotato &&
                combinedPotato < r.potatoHigh! &&
                r.sugarbeetLow! <= d_cp_sugarbeet &&
                d_cp_sugarbeet < r.sugarbeetHigh! &&
                r.omLow <= a_som_loi &&
                a_som_loi < r.omHigh,
        )
        phOptimum = row?.phOptimum
    } else if (table === "5.2") {
        const row = TABLE_5_2.find(
            (r) =>
                r.potatoLow! <= combinedPotato &&
                combinedPotato < r.potatoHigh! &&
                r.sugarbeetLow! <= d_cp_sugarbeet &&
                d_cp_sugarbeet < r.sugarbeetHigh! &&
                r.omLow <= a_som_loi &&
                a_som_loi < r.omHigh,
        )
        phOptimum = row?.phOptimum
    } else {
        const rows = table === "mh" ? TABLE_MH : TABLE_MH_KL
        const row = rows.find(
            (r) => r.omLow <= a_som_loi && a_som_loi < r.omHigh,
        )
        phOptimum = row?.phOptimum
    }

    if (phOptimum === undefined) return null
    return Math.max(0, phOptimum - a_ph_cc)
}
