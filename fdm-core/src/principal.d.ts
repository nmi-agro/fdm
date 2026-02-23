/**
 * @typedef Principal
 * @property {string} id - The unique identifier of the principal.
 * @property {string} username - The username or slug of the principal.
 * @property {string | null} email - The email address of the principal (can be null for organizations).
 * @property {string} initials - The initials of the principal.
 * @property {string | null} displayUserName - The display name of the principal (can be null).
 * @property {string | null} image - The image URL of the principal (can be null).
 * @property {"user" | "organization"} type - The type of the principal (either "user" or "organization").
 * @property {boolean} isVerified - Indicates whether the principal is verified.
 */
export type Principal = {
    id: string
    username: string
    email: string | null
    initials: string
    displayUserName: string | null
    image: string | null
    type: "user" | "organization"
    isVerified: boolean
}
