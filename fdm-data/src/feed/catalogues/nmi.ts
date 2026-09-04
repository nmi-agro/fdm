import type { CatalogueFeed, CatalogueFeedItem } from "../d"
import { hashFeed } from "../hash"

/**
 * Example list of feed types derived from RVO Tabel 8 and some additions.
 *
 * @see https://www.rvo.nl/sites/default/files/2026-02/Tabel-8-Opbrengst-en-stikstof-en-fosfaat-in-diervoer-2026.pdf
 */
export const feedRows: Array<
  Omit<CatalogueFeedItem, "f_id_catalogue" | "f_source" | "hash"> & {
    f_dm?: number | null
    f_n_dm?: number | null
    f_p_dm?: number | null
  }
> = [
  {
    f_name_nl: "Snijmaïs",
    f_type_rvo: "snijmais",
    f_dm: 367.7,
    f_n_dm: 11.3,
    f_p_dm: 4.5,
  },
  {
    f_name_nl: "Maïskolvenschroot",
    f_type_rvo: "maiskolvenschroot",
    f_dm: 557.1,
    f_n_dm: 14.4,
    f_p_dm: 5.7,
  },
  {
    f_name_nl: "Corncobmix (100% spil)",
    f_type_rvo: "corncobmix_100",
    f_dm: 526.7,
    f_n_dm: 15.5,
    f_p_dm: 6.9,
  },
  {
    f_name_nl: "Corncobmix (25% spil)",
    f_type_rvo: "corncobmix_25",
    f_dm: 637.1,
    f_n_dm: 15,
    f_p_dm: 6.9,
  },
  {
    f_name_nl: "Korrelmaïs",
    f_type_rvo: "korrelmais",
    f_dm: 868.1,
    f_n_dm: 12.2,
    f_p_dm: 5.5,
  },
  {
    f_name_nl: "Gehele plant silage",
    f_type_rvo: "gehele_plant_silage",
    f_dm: 838.1,
    f_n_dm: 17.6,
    f_p_dm: 6.9,
  },
  { f_name_nl: "Tarwe", f_type_rvo: "tarwe", f_dm: 863.6, f_n_dm: 20.9, f_p_dm: 7.5 },
  {
    f_name_nl: "Erwten",
    f_type_rvo: "erwten",
    f_dm: 846.2,
    f_n_dm: 37.5,
    f_p_dm: 9.8,
  },
  { f_name_nl: "Gerst", f_type_rvo: "gerst", f_dm: 867.6, f_n_dm: 18.5, f_p_dm: 8.2 },
  {
    f_name_nl: "Aardappelen (vers)",
    f_type_rvo: "aardappelen_vers",
    f_dm: 201.6,
    f_n_dm: 16.8,
    f_p_dm: 4.6,
  },
  {
    f_name_nl: "Aardappelen (ingekuild)",
    f_type_rvo: "aardappelen_ingekuild",
    f_dm: null,
    f_n_dm: 10.4,
    f_p_dm: 4.6,
  },
  { f_name_nl: "Appelen", f_type_rvo: "appelen", f_dm: null, f_n_dm: 4.2, f_p_dm: 1.6 },
  {
    f_name_nl: "Graanstro (rogge)",
    f_type_rvo: "graanstro_rogge",
    f_dm: 837.2,
    f_n_dm: 4.6,
    f_p_dm: 2.3,
  },
  {
    f_name_nl: "Graanstro (tarwe)",
    f_type_rvo: "graanstro_tarwe",
    f_dm: 853.7,
    f_n_dm: 6.6,
    f_p_dm: 2.1,
  },
  { f_name_nl: "Gras (hooi)", f_type_rvo: "gras_hooi", f_dm: null, f_n_dm: 21.1, f_p_dm: 6.2 },
  { f_name_nl: "Gras (ingekuild)", f_type_rvo: "gras_kuil", f_dm: null, f_n_dm: 27.9, f_p_dm: 9.4 },
  { f_name_nl: "Gras (vers)", f_type_rvo: "gras_vers", f_dm: null, f_n_dm: null, f_p_dm: null },
  {
    f_name_nl: "Graszaadstro",
    f_type_rvo: "graszaadstro",
    f_dm: null,
    f_n_dm: 9.9,
    f_p_dm: 4.4,
  },
  { f_name_nl: "Rogge", f_type_rvo: "rogge", f_dm: 868.4, f_n_dm: 15.5, f_p_dm: 8.2 },
  { f_name_nl: "Uien", f_type_rvo: "uien", f_dm: 117.6, f_n_dm: 21.6, f_p_dm: 6.9 },
  {
    f_name_nl: "Voederbieten",
    f_type_rvo: "voederbieten",
    f_dm: 155,
    f_n_dm: 12.5,
    f_p_dm: 4.6,
  },
  {
    f_name_nl: "Witlofwortelen",
    f_type_rvo: "witlofwortelen",
    f_dm: null,
    f_n_dm: 8.2,
    f_p_dm: 5.7,
  },
  { f_name_nl: "Kaaswei", f_type_rvo: "kaaswei", f_dm: null, f_n_dm: 37, f_p_dm: 24.4 },
  {
    f_name_nl: "Krachtvoer / brokken",
    f_type_rvo: "krachtvoer",
    f_dm: null,
    f_n_dm: null,
    f_p_dm: null,
  },
  { f_name_nl: "Mineralen", f_type_rvo: "mineralen", f_dm: null, f_n_dm: null, f_p_dm: null },
]

export const feedTypeOptions = feedRows.map(({ f_name_nl, f_type_rvo }) => ({
  value: f_type_rvo,
  label: f_name_nl,
}))

export async function getCatalogueNmi(): Promise<CatalogueFeed> {
  return await Promise.all(
    feedRows.map(async (row, index) => {
      const item: CatalogueFeedItem = {
        ...row,
        f_source: "nmi",
        f_id_catalogue: `nmi_${String(index + 1).padStart(3, "0")}`,
        hash: null,
      }
      item.hash = await hashFeed(item)
      return item
    }),
  )
}
