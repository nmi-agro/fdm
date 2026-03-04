import z from "zod"

function isValidSlug(slug: string): boolean {
    // Slug must be lowercase
    if (slug.toLowerCase() !== slug) {
        return false
    }

    // Slug must be at least 3 characters long
    if (slug.length < 3) {
        return false
    }

    // Slug should only contain lowercase letters, numbers, and hyphens
    // Must start and end with alphanumeric, no consecutive hyphens
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
}

export const FormSchema = z.object({
    name: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? "Naam van de organisatie is verplicht"
                    : undefined,
        })
        .trim()
        .min(3, {
            error: "Naam van de organisatie moet minimaal 3 karakters bevatten",
        }),
    slug: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? "ID van de organisatie is verplicht"
                    : undefined,
        })
        .trim()
        .refine(isValidSlug, {
            error: "ID moet minimaal 3 karakters bevatten, enkel kleine letters, cijfers of '-'",
        }),
    description: z.string({}).optional(),
})
