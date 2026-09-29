import z from "zod"

export const SavedReplyContextSchema = z.object({
  farm_name: z.string().optional(),
  customer_name: z.string().optional(),
  agent_name: z.string().optional(),
  ticket_ref: z.string().optional(),
})

export type FdmSavedReplyContext = z.infer<typeof SavedReplyContextSchema>

export const ApplySavedReplySchema = SavedReplyContextSchema.extend({
  reply_id: z.string(),
})

export const MakeSavedReplySchema = SavedReplyContextSchema.extend({
  body: z.string().min(1),
})

export const CreateSavedReplySchema = z.object({
  intent: z.literal("create_saved_reply"),
  title: z.string().min(1),
  body: z.string().min(1),
  is_shared: z.boolean().optional(),
})

export const DeleteSavedReplySchema = z.object({
  intent: z.literal("delete_saved_reply"),
  reply_id: z.string(),
})
