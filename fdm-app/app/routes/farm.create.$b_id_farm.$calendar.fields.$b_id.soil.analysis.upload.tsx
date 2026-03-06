import {
    addSoilAnalysis,
    getField,
    getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import { createFsFileStorage } from "@remix-run/file-storage/fs"
import { type FileUpload, parseFormData } from "@remix-run/form-data-parser"
import { fileTypeFromBuffer } from "file-type"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
} from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import {
    FormSchema,
    SoilAnalysisUploadForm,
} from "~/components/blocks/soil/form-upload"
import { extractSoilAnalysis } from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

/**
 * Loader function for the soil analysis upload page.
 *
 * Fetches the field details and soil parameter descriptions.
 *
 * @param request - The HTTP request object.
 * @param params - The route parameters containing `b_id_farm` and `b_id`.
 * @returns An object containing the field details and soil parameter descriptions.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        // Get the field id
        const b_id = params.b_id
        if (!b_id) {
            throw data("Field ID is required", {
                status: 400,
                statusText: "Field ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get details of field
        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("Field is not found", {
                status: 404,
                statusText: "Field is not found",
            })
        }

        // Get soil parameter descriptions
        const soilParameterDescription = getSoilParametersDescription()

        // Return user information from loader
        return {
            field: field,
            soilParameterDescription: soilParameterDescription,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the soil analysis upload form.
 *
 * @returns The JSX element for the soil analysis upload form.
 */

export default function FarmFieldSoilAnalysisUploadBlock() {
    return (
        <div className="space-y-6">
            <SoilAnalysisUploadForm />
        </div>
    )
}

/**
 * Action function for uploading a soil analysis file.
 *
 * @param request - The HTTP request object.
 * @param params - The route parameters containing `b_id_farm` and `b_id`.
 * @returns A redirect response to the soil analysis page.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    // Get the farm id
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
        throw data("Farm ID is required", {
            status: 400,
            statusText: "Farm ID is required",
        })
    }

    // Get the field id
    const b_id = params.b_id
    if (!b_id) {
        throw data("Field ID is required", {
            status: 400,
            statusText: "Field ID is required",
        })
    }

    try {
        // Get the session
        const session = await getSession(request)

        const fileStorage = createFsFileStorage("./uploads/soil_analyses")

        const uploadHandler = async (fileUpload: FileUpload) => {
            if (
                fileUpload.fieldName === "soilAnalysisFile" &&
                fileUpload.type === "application/pdf"
            ) {
                // Check file type based on magic bytes
                const fileBuffer = await fileUpload.arrayBuffer()
                const fileType = await fileTypeFromBuffer(fileBuffer)

                if (fileType?.mime !== "application/pdf") {
                    throw new Error("Invalid file type (magic bytes check)")
                }

                // We need to create a new File object from the buffer
                const file = new File([fileBuffer], fileUpload.name, {
                    type: fileUpload.type,
                })
                const storageKey = crypto.randomUUID()
                await fileStorage.set(storageKey, file)

                const storedFile = await fileStorage.get(storageKey)
                if (
                    storedFile &&
                    "toFile" in storedFile &&
                    typeof storedFile.toFile === "function"
                ) {
                    return (
                        storedFile as unknown as { toFile: () => File }
                    ).toFile()
                }
                return storedFile
            }
            throw new Error("Invalid file type (mime check)")
        }

        const formData = await parseFormData(
            request,
            { maxFileSize: 5 * 1024 * 1024 },
            uploadHandler,
        )
        const file = formData.get("soilAnalysisFile") as File | undefined

        // Server-side validation using Zod schema
        const parsedFile = FormSchema.safeParse({ soilAnalysisFile: file })
        if (!parsedFile.success) {
            throw data(parsedFile.error.flatten(), { status: 400 })
        }
        if (!file) {
            throw data("No file uploaded", { status: 400 })
        }

        // Submit to NMI API
        const soilAnalysisResult = await extractSoilAnalysis(formData)

        // Validate required fields exist
        if (!soilAnalysisResult.a_depth_lower) {
            throw new Error("Missing required a_depth_lower value")
        }
        if (!soilAnalysisResult.b_sampling_date) {
            throw new Error("Missing required b_sampling_date")
        }
        if (
            soilAnalysisResult.a_depth_upper === undefined ||
            soilAnalysisResult.a_depth_upper === null
        ) {
            throw new Error("Missing required a_depth_upper value")
        }

        // Exclude a_source from the spread
        const { a_source, ...soilAnalysisData } = soilAnalysisResult as any

        // Add soil analysis
        await addSoilAnalysis(
            fdm,
            session.principal_id,
            null,
            (soilAnalysisResult as any).a_source || "other",
            b_id,
            Number(soilAnalysisResult.a_depth_lower),
            new Date(soilAnalysisResult.b_sampling_date),
            soilAnalysisData,
            Number(soilAnalysisResult.a_depth_upper),
        )

        const url = new URL(request.url)

        // Search needed for the /farm/$b_id_farm/$calendar/field/new/fields route
        return redirectWithSuccess(`../${url.search}`, {
            message: "Bodemanalyse is toegevoegd! 🎉",
        })
    } catch (error) {
        if (
            error instanceof Error &&
            (error.message === "Invalid file type (magic bytes check)" ||
                error.message === "Invalid file type (mime check)")
        ) {
            return dataWithError(
                null,
                "Het bestand is ongeldig. Controleer het bestand en probeer het opnieuw",
            )
        }

        if (
            error instanceof Error &&
            error.message === "Invalid soil analysis"
        ) {
            return dataWithError(
                null,
                "Helaas is het niet gelukt om de pdf te analyseren. Controleer het bestand of neem contact op met Ondersteuning",
            )
        }

        throw handleActionError(error)
    }
}
