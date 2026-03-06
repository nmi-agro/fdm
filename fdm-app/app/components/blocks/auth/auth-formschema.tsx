import z from "zod"

export const FormSchema = z.object({
    code: z
        .string({
            error: "Vul de verificatiecode in",
        })
        .trim()
        .min(8, {
            message: "De code moet uit 8 tekens bestaan",
        })
        .max(8, {
            message: "De code moet uit 8 tekens bestaan",
        }),
    redirectTo: z.string().optional(),
})
