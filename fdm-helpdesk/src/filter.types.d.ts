export type ActivityFilter = {
    /** Is the agent active */
    isActive?: boolean
}

export type AssigneeFilter = {
    /** Is the ticket assigned at all */
    assigned?: boolean
    /** Agent IDs that the ticket is assigned to */
    assignees?: string[]
}

export type TicketContextFilter = {
    /** Context for the ticket */
    context?: {
        /** ID of the farm that the ticket is related to */
        b_id_farm?: string
    }
}

export type IncludeDeletedFilter = {
    /** Whether to include any deleted items */
    includeDeleted?: boolean
}

export type InternalMessageFilter = {
    /** Is the message internal */
    isInternal?: boolean
}

export type PaginationFilter = {
    /** Index of the first record to return */
    pageOffset?: number
    /** Maximum number of records to return */
    pageLimit?: number
}

type PriorityString = "low" | "normal" | "high" | "urgent"
export type PriorityFilter = {
    /** Minimum priority */
    minPriority?: PriorityString
    /** Maximum priority */
    maxPriority?: PriorityString
}

export type RequesterFilter = {
    /** Requester principal IDs */
    requesterIds?: string[]
}

export type SenderFilter = {
    /** Principal or agent IDs for the messages */
    sentBy?: string[]
}

export type TagsFilter = {
    /** Tag IDs to filter the records by */
    tags?: string[]
}

export type TextFilter = {
    /** Text to search for */
    text?: string
}

export type TicketStatusFilter = {
    /** Ticket status */
    statuses?: string[]
}

export type TimeframeFilter = {
    /** Date to only return the records after */
    fromDate?: Date
    /** Date to only return the records before */
    toDate?: Date
}

export type ViewedByFilter = {
    /** Has any of the actors viewed the ticket */
    viewedBy?: string[]
    /** Has any of the actors not viewed the ticket */
    notViewedBy?: string[]
}

export type AgentFilters = ActivityFilter & PaginationFilter & TextFilter

export type MessageFilters = TimeframeFilter &
    SenderFilter &
    IncludeDeletedFilter &
    InternalMessageFilter &
    PaginationFilter

export type TicketFilters = AssigneeFilter &
    TicketContextFilter &
    TicketStatusFilter &
    PaginationFilter &
    PriorityFilter &
    RequesterFilter &
    TagsFilter &
    TextFilter &
    TimeframeFilter &
    ViewedByFilter

export type TicketSorting = "created" | "priority" | "text_relevance"
