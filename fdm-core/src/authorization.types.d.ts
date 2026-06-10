import type * as authZSchema from "./db/schema-authz"

export type Resource =
    | "user"
    | "organization"
    | "farm"
    | "field"
    | "cultivation"
    | "soil_analysis"
    | "soil_image"
    | "fertilizer_application"
    | "harvesting"
export type Role = "owner" | "advisor" | "researcher"
export type Action = "read" | "write" | "list" | "share"

export interface Permission {
    resource: Resource
    role: Role | Role[]
    action: Action | Action[]
}

export type PrincipalId =
    | authZSchema.roleTypeSelect["principal_id"]
    | authZSchema.roleTypeSelect["principal_id"][]

export type PrincipalWithRoles = {
    principal_id: string
    role: Role
    principal_type: "user" | "organization"
}

export type ResourceId = authZSchema.roleTypeSelect["resource_id"]

export interface ResourceBead {
    resource: Resource
    resource_id: ResourceId
}

export type ResourceChain = ResourceBead[]

/**
 * Audit context carried implicitly through an async call chain.
 * Set once at the boundary (HTTP handler, queue consumer, etc.) and
 * read by `checkPermission` without threading extra arguments through
 * every intermediate function.
 */
export interface AuditContext {
    /** Channel that originated the request. Defaults to "app". */
    channel: "app" | "api"
    /** Session ID (app) or API key ID (api) that originated the request. */
    credential_id?: string
}
