import z from "zod"

export const FormSchema = z.object({
  code: z
    .string({
      error: "Vul de verificatiecode in",
    })
    .trim()
    .length(6, {
      message: "De code moet uit 6 cijfers bestaan",
    })
    .regex(/^[0-9]+$/, {
      message: "De code moet uit 6 cijfers bestaan",
    }),
  redirectTo: z.string().optional(),
})
