import z from "zod"

const PositionSchema = z.preprocess(
  (val) => (typeof val === "string" ? Number(val) : val),
  z
    .number()
    .gt(-0.001)
    .transform((x) => Math.max(0, Math.floor(x))),
)

const SizeSchema = z.preprocess(
  (val) => (typeof val === "string" ? Number(val) : val),
  z
    .number()
    .gt(-0.001)
    .transform((x) => Math.max(1, Math.floor(x))),
)
export const ProfilePictureSchema = z.object({
  cropRectX: PositionSchema,
  cropRectY: PositionSchema,
  cropRectWidth: SizeSchema,
  cropRectHeight: SizeSchema,
})
