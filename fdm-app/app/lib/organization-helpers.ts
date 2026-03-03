import type { Organization } from "better-auth/plugins"

export interface OrganizationMetadata {
    description?: string | undefined
}

export type ParseOrganizationMetadataResult = ReturnType<
    typeof parseOrganizationMetadata
>

export interface ParsedOrganization extends Organization {
    metadata: ParseOrganizationMetadataResult
}

/**
 * Parses the organization metadata, and returns either an object that holds the metadata, or an object that holds an error.
 *
 * @param organization The organization to parse the metadata for
 * @returns an object with either a data field, which is the organization's parsed metadata, or an object with an error field that holds a throwable error
 */
export function parseOrganizationMetadata(organization: Organization): {
    data?: OrganizationMetadata
    error?: Error
} {
    try {
        let parsedMetadata = JSON.parse(organization.metadata)
        try {
            parsedMetadata.description = JSON.parse(
                `"${parsedMetadata.description}"`,
            )
        } catch (_triedAndDidNotWork) {}
        return {
            data: parsedMetadata,
        }
    } catch (e) {
        return {
            error: new Error(
                `Failed to parse organization metadata for ${organization.slug}`,
                { cause: e },
            ),
        }
    }
}

export function getOrganizationRoleLabel(role: string) {
    const map: Record<string, string> = {
        owner: "Eigenaar",
        admin: "Beheerder",
        member: "Lid",
    }
    return map[role] ?? map.member
}
