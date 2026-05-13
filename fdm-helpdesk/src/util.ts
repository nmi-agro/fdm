export type PaginationFilter = {
    /** Index of the first record to return */
    pageOffset?: number
    /** Maximum number of records to return */
    pageLimit?: number
}

export type TagsFilter = {
    /** Tag names (not IDs) to filter the records by */
    tags?: string[]
}

export type TimeframeFilter = {
    /** Date to only return the records after */
    fromDate?: Date
    /** Date to only return the records before */
    toDate?: Date
}

export type RequesterFilter = {
    /** Requester principal IDs */
    requesterIds?: string[]
    /** Requester email addresses */
    requesterEmails?: string[]
}

export type AssigneeFilter = {
    /** Agent IDs that the ticket is assigned to */
    assignees?: string[]
}

export type SenderFilter = {
    /** Principal or agent IDs for the messages */
    sentBy?: string[]
}

export type IncludeDeletedFilter = {
    /** Whether to include any deleted items */
    includeDeleted?: boolean
}
