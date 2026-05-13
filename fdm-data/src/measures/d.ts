export type CatalogueMeasureName = "bln"

export interface CatalogueMeasureItem {
    m_id: string // "bln_BM1", "bln_BM2", etc.
    m_source: CatalogueMeasureName | string // "bln"; future: "anlb", etc.
    m_name: string
    m_description: string | null
    m_summary: string | null
    m_source_url: string | null
    m_conflicts: string[] | null // m_id values, e.g. ["bln_BM2"]
    hash?: string | null
}

export type CatalogueMeasure = CatalogueMeasureItem[]
