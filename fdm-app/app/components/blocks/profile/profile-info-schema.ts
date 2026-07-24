import z from "zod"

export const ProfileInfoSchema = z.object({
  firstname: z
    .string({
      error: (issue) => (issue.input === undefined ? "Vul je voornaam in" : undefined),
    })
    .trim()
    .min(1, {
      error: "Vul je voornaam in",
    }),
  surname: z
    .string({
      error: (issue) => (issue.input === undefined ? "Vul je achternaam in" : undefined),
    })
    .trim()
    .min(1, {
      error: "Vul je achternaam in",
    }),
})
