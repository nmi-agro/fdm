export type MeasureCatalogue = {
    m_id: string // "bln_BM1", etc.
    m_source: string // "bln", etc.
    m_name: string
    m_description: string | null
    m_summary: string | null
    m_source_url: string | null
    m_conflicts: string[] | null // m_id values
}

export type Measure = {
    b_id_measure: string
    m_id: string
    b_id: string
    m_start: Date | null
    m_end: Date | null // null = doorlopend / ongoing
    // Denormalized from measures_catalogue:
    m_name: string
    m_summary: string | null
    m_conflicts: string[] | null
}
