import type { TicketFilters } from "@nmi-agro/fdm-helpdesk"
import z from "zod"

const BooleanSchema = z.coerce
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true"))
const PrioritySchema = z.enum(["low", "normal", "high", "urgent"])
const DateSchema = z
    .preprocess(
        (val) => (typeof val === "string" ? new Date(val) : val),
        z.date({
            error: (issue) =>
                issue.input === undefined
                    ? "Datum is verplicht"
                    : "Datum is ongeldig",
        }),
    )
    .nullish()
    .transform((val) => val ?? undefined)

export const TicketFilterSchema = z.object({
    assigned: BooleanSchema,
    assignees: z.array(z.string().min(1)).optional(),
    context: z
        .object({
            b_id_farm: z.string().min(1).optional(),
        })
        .optional(),
    pageOffset: z.number().optional(),
    pageLimit: z.number().optional(),
    minPriority: PrioritySchema.optional(),
    maxPriority: PrioritySchema.optional(),
    requesterIds: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().min(1)).optional(),
    fromDate: DateSchema.optional(),
    toDate: DateSchema.optional(),
    text: z.string().optional(),
})

//@ts-expect-error this is to confirm that the schema type matches TicketFilters
const _ = {} as z.infer<typeof TicketFilterSchema> satisfies TicketFilters
