import type { Table9 } from "./types"

export const table9: Table9 = [
  {
    description: "Drijfmest van graasdieren op het eigen bedrijf geproduceerd",
    p_type_rvo: ["14", "60", "18", "19"],
    onFarmProduced: true,
    subTypes: [
      {
        description: "Op bedrijf met beweiding",
        b_grazing_intention: true,
        p_n_wcl: 0.45,
      },
      {
        description: "Op bedrijf zonder beweiding",
        b_grazing_intention: false,
        p_n_wcl: 0.6,
      },
    ],
  },
  {
    description: "Drijfmest van graasdieren aangevoerd",
    p_type_rvo: ["14", "60", "18", "19"],
    onFarmProduced: false,
    p_n_wcl: 0.6,
  },
  {
    description: "Drijfmest van varkens",
    p_type_rvo: ["46", "50"],
    subTypes: [
      {
        description: "Op klei en veen",
        grondsoortCode: ["klei", "veen"],
        p_n_wcl: 0.6,
      },
      {
        description: "Op zand en löss",
        grondsoortCode: ["zand_nwc", "zand_zuid", "loess"],
        p_n_wcl: 0.8,
      },
    ],
  },
  {
    description: "Drijfmest van overige diersoorten",
    p_type_rvo: ["30", "76", "81", "91", "92"],
    p_n_wcl: 0.6,
  },
  {
    description: "Dunne fractie na mestbewerking en gier",
    p_type_rvo: ["12", "17", "41", "42"],
    p_n_wcl: 0.8,
  },
  {
    description: "Vaste mest van graasdieren op het eigen bedrijf geproduceerd",
    p_type_rvo: ["10", "56", "61", "25", "26", "27", "95", "96"],
    onFarmProduced: true,
    subTypes: [
      {
        description: "Op bouwland op klei en veen, van 1 september t/m 31 januari",
        grondsoortCode: ["klei", "veen"],
        isBouwland: true,
        applicationPeriod: "1 september t/m 31 januari",
        p_n_wcl: 0.3,
      },
      {
        description: "Overige toepassingen op bedrijf met beweiding",
        b_grazing_intention: true,
        p_n_wcl: 0.45,
      },
      {
        description: "Overige toepassingen op bedrijf zonder beweiding",
        b_grazing_intention: false,
        p_n_wcl: 0.6,
      },
    ],
  },
  {
    description: "Vaste mest van graasdieren aangevoerd",
    p_type_rvo: ["10", "56", "61", "25", "26", "27", "95", "96"],
    onFarmProduced: false,
    subTypes: [
      {
        description: "Op bouwland op klei en veen, van 1 september t/m 31 januari",
        grondsoortCode: ["klei", "veen"],
        isBouwland: true,
        applicationPeriod: "1 september t/m 31 januari",
        p_n_wcl: 0.3,
      },
      {
        description: "Overige toepassingen",
        p_n_wcl: 0.4,
      },
    ],
  },
  {
    description: "Vaste mest van varkens, pluimvee en nertsen",
    p_type_rvo: [
      "23",
      "31",
      "32",
      "33",
      "35",
      "39",
      "40",
      "43",
      "75",
      "80",
      "97",
      "98",
      "99",
      "100",
      "101",
    ],
    p_n_wcl: 0.55,
  },
  {
    description: "Vaste mest van overige diersoorten",
    p_type_rvo: [
      "11",
      "13",
      "24",
      "30",
      "76",
      "81",
      "90",
      "91",
      "92",
      "102",
      "103",
      "104",
      "105",
      "106",
    ],
    subTypes: [
      {
        description: "Op bouwland op klei en veen, van 1 september t/m 31 januari",
        grondsoortCode: ["klei", "veen"],
        isBouwland: true,
        applicationPeriod: "1 september t/m 31 januari",
        p_n_wcl: 0.3,
      },
      {
        description: "Overige toepassingen",
        p_n_wcl: 0.4,
      },
    ],
  },
  {
    description: "Compost",
    p_type_rvo: ["111", "112"],
    p_n_wcl: 0.1,
  },
  {
    description: "Champost",
    p_type_rvo: ["110", "117"],
    p_n_wcl: 0.25,
  },
  {
    description: "Zuiveringsslib",
    p_type_rvo: ["113", "114"],
    p_n_wcl: 0.4,
  },
  {
    description: "Overige organische meststoffen",
    p_type_rvo: ["116"],
    p_n_wcl: 0.5,
  },
  {
    description: "Mineralenconcentraat",
    p_type_rvo: ["120"],
    p_n_wcl: 1,
  },
]
