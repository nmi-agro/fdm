export interface HelpdeskUser {
    principal_id: string
    displayUserName: string | null
    image: string | null
    initials: string | null
    icon?: "agent" | "customer"
}
