import z from "zod"

export const FormSchema = z.object({
  code: z
    .string({
      error: "Vul de verificatiecode in",
    })
    .trim()
    .min(6, {
      message: "De code moet uit 6 cijfers bestaan",
    })
    .max(6, {
      message: "De code moet uit 6 cijfers bestaan",
    })
    .regex(/^\d+$/, {
      message: "De code mag alleen cijfers bevatten",
    }),
  redirectTo: z.string().optional(),
})
