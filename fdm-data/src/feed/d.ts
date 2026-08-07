export type CatalogueFeedName = "nmi"

export interface CatalogueFeedItem {
  f_source: CatalogueFeedName | string
  f_id_catalogue: string
  f_name_nl: string
  f_type_rvo: string
  f_dm?: number | null
  f_n_dm?: number | null
  f_p_dm?: number | null
  hash?: string | null | undefined
}

export type CatalogueFeed = CatalogueFeedItem[]
