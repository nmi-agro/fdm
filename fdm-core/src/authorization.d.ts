import type * as authZSchema from "./db/schema-authz"

export type Resource =
    | "user"
    | "organization"
    | "farm"
    | "field"
    | "cultivation"
    | "soil_analysis"
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
