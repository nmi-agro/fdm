import type { ZodSchema, z } from "zod"
import { handleActionError } from "./error"

/**
 * Extracts, validates, and transforms form data from a request using a Zod schema.
 *
 * This function is designed to simplify the process of handling form data in Remix
 * action functions. It extracts the form data from the request, validates it against
 * the provided Zod schema, and returns the parsed data. If validation fails, it throws
 * an error with detailed information about the validation errors.
 *
 * @param request - The HTTP request object.
 * @param schema - The Zod schema to validate the form data against.
 * @returns The parsed and validated form data.
 * @throws {Response} If the form data fails validation, includes error details.
 */
export async function extractFormValuesFromRequest<T extends ZodSchema>(
    request: Request,
    schema: T,
) {
    try {
        const formData = await request.formData()
        const formObject = Object.fromEntries(formData) as Record<
            string,
            FormDataEntryValue | unknown[] | null | boolean | undefined
        >

        // Trim all values and remove quotation marks
        // Note: Somewhere additional quotation marks are added, preferably that is not the case, but this workaround removes them
        for (const key in formObject) {
            const value = formObject[key]

            if (typeof value === "string") {
                // Check if the value is a JSON array string
                if (
                    value.startsWith("[") &&
                    value.endsWith("]") &&
                    key !== "b_geometry"
                ) {
                    try {
                        formObject[key] = JSON.parse(value)
                    } catch (_e) {
                        // Not a valid JSON, so leave it as a string
                    }
                } else if (key !== "b_geometry") {
                    formObject[key] = value.replace(/['"]+/g, "").trim()
                }

                const cleanedValue = formObject[key]

                // Parse boolean values
                if (cleanedValue === "true" || cleanedValue === "on") {
                    formObject[key] = true
                } else if (cleanedValue === "false") {
                    formObject[key] = false
                }

                // Parse null values at formData
                if (value === "null" || cleanedValue === "null") {
                    formObject[key] = null
                }

                // Daypicker returns 01 Jan 1970 if no date is selected. This workaround removes the date if it is 01 Jan 1970
                if (value === '"1970-01-01T00:00:00.000Z"') {
                    delete formObject[key]
                }
            }
        }
        const parsedData = schema.safeParse(formObject)

        if (!parsedData.success) {
            const errors = parsedData.error.issues.map((err) => ({
                path: err.path.join("."),
                message: err.message,
            }))

            throw new Error(JSON.stringify(errors))
        }

        return parsedData.data as z.infer<T>
    } catch (error) {
        throw handleActionError(error)
    }
}
