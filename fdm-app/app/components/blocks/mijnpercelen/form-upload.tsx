import { zodResolver } from "@hookform/resolvers/zod"
import {
    AlertCircle,
    CheckCircle,
    Circle,
    FileUp,
    FlaskConical,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Form, NavLink, useActionData, useNavigation } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { parseDbf } from "shpjs"
import { toast as notify } from "sonner"
import { z } from "zod"
import { cn } from "@/app/lib/utils"
import { Dropzone } from "~/components/custom/dropzone"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "~/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    FormDescription,
    FormField,
    FormItem,
    FormMessage,
} from "~/components/ui/form"
import { Spinner } from "~/components/ui/spinner"

import { MijnPercelenUploadAnimation } from "./upload-animation"

type UploadState = "idle" | "animating" | "success" | "error"

const ANIMATION_ENABLED = true // Switch for the animation

export function MijnPercelenUploadForm({
    b_id_farm,
    calendar,
}: {
    b_id_farm: string
    calendar: string
}) {
    const [fieldNames, setFieldNames] = useState<string[]>([])
    const [uploadState, setUploadState] = useState<UploadState>("idle")
    const uploadStartTime = useRef<number | null>(null)

    const requiredExtensions = [".shp", ".shx", ".dbf", ".prj"]

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: {
            shapefile: [],
        },
    })

    const actionData = useActionData<{
        message?: string
        fieldErrors?: Record<string, string[]>
        formErrors?: string[]
    } | null>()
    const navigation = useNavigation()
    const isSubmitting = navigation.state !== "idle"

    // Effect to start the animation
    useEffect(() => {
        if (isSubmitting) {
            setUploadState("animating")
            uploadStartTime.current = Date.now()
        }
    }, [isSubmitting])

    // Effect to handle the end of the animation
    useEffect(() => {
        if (actionData && uploadState === "animating") {
            const elapsedTime =
                Date.now() - (uploadStartTime.current || Date.now())
            const minAnimationTime = 4000
            const remainingTime = Math.max(0, minAnimationTime - elapsedTime)

            const timer = setTimeout(() => {
                if (actionData.message) {
                    setUploadState("success")
                } else {
                    setUploadState("error")
                }
            }, remainingTime)

            return () => clearTimeout(timer)
        }
    }, [actionData, uploadState])

    // Effect to reset the form after success/error message
    useEffect(() => {
        if (uploadState === "success" || uploadState === "error") {
            const timer = setTimeout(() => {
                setUploadState("idle")
                form.reset()
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [uploadState, form.reset])

    const selectedFiles = form.watch("shapefile")

    const selectedFileExtensions = selectedFiles.map((file) =>
        getFileExtension(file.name),
    )
    const hasAllRequiredFiles = requiredExtensions.every((ext) =>
        selectedFileExtensions.includes(ext),
    )

    useEffect(() => {
        return () => {
            form.reset()
        }
    }, [form.reset])

    const handleFilesSet = async (validFiles: File[]) => {
        form.setValue("shapefile", validFiles)
        setUploadState("idle")

        const dbfFile = validFiles.find(
            (file) => getFileExtension(file.name) === ".dbf",
        )
        if (dbfFile) {
            try {
                const dbfBuffer = await dbfFile.arrayBuffer()
                const dbfData = parseDbf(dbfBuffer) as any[]
                let unnamedCount = 0
                const names = dbfData.map(
                    (row) => row?.NAAM ?? `Naamloos perceel ${++unnamedCount}`,
                )
                setFieldNames(names)
            } catch (error) {
                console.error("Failed to parse DBF file:", error)
                notify.error("Kon het DBF bestand niet verwerken")
                setFieldNames([])
            }
        } else {
            setFieldNames([])
        }
    }

    const disabledForm = (
        <Card className="w-full max-w-lg mx-auto">
            <CardHeader className="space-y-6">
                <CardTitle>Shapefile uploaden</CardTitle>
                <Alert>
                    <FlaskConical className="h-4 w-4" />
                    <AlertTitle>Experimentele functie</AlertTitle>
                    <AlertDescription className="text-muted-foreground">
                        Deze functie is nog in ontwikkeling. Laat ons het weten
                        als je feedback hebt!
                    </AlertDescription>
                </Alert>
                <CardDescription>
                    Selecteer de bestanden van uw RVO Mijn Percelen export. Zorg
                    ervoor dat u alle bijbehorende bestanden selecteert (.shp,
                    .shx, .dbf, .prj).
                </CardDescription>
                <Accordion type="single" collapsible>
                    <AccordionItem value="item-1">
                        <AccordionTrigger>
                            Hoe download ik een shapefile van mijn.rvo.nl?
                        </AccordionTrigger>
                        <AccordionContent>
                            <ol className="list-decimal list-inside space-y-2">
                                <li>Log in op mijn.rvo.nl.</li>
                                <li>
                                    Ga via ‘’Registratie en meldingen
                                    doorgeven’’ naar ‘’Percelen registreren’’.
                                </li>
                                <li>
                                    Klik op ‘’Registreren en wijzigen’’ onder
                                    ‘’Mijn percelen’’.
                                </li>
                                <li>
                                    Ga bij ‘’Mijn percelen’’ naar ‘’Wijzigen’’.
                                </li>
                                <li>
                                    Klik op de datum om het juiste jaar en de
                                    juiste peildatum in te stellen waarvoor u de
                                    gecombineerde opgave wilt downloaden.
                                </li>
                                <li>
                                    Klik op het zwarte/blauwe pijltje dat naar
                                    beneden wijst. Vervolgens verschijnt er een
                                    klein uitklapmenu waar ‘”Shape’’ tussen
                                    staat. Klik hierop om de gecombineerde
                                    opgave in ‘’shapefile’’ formaat te
                                    downloaden.
                                </li>
                            </ol>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        <div
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-32 rounded-md border border-dashed border-muted-foreground/25 px-6 py-4 text-center transition-colors",
                            )}
                        >
                            <FileUp className="w-8 h-8 mb-2 text-muted-foreground" />
                            <div className="text-sm text-muted-foreground">
                                {selectedFiles.length > 0
                                    ? selectedFiles
                                          .map((file) => file.name)
                                          .join(", ")
                                    : "Klik om te uploaden of sleep de bestanden hierheen"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                .shp, .shx, .dbf, .prj
                            </div>
                        </div>
                        <Button className="w-full" disabled>
                            Uploaden
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )

    return (
        <div className="flex justify-center">
            {uploadState === "animating" && ANIMATION_ENABLED ? (
                <MijnPercelenUploadAnimation fieldNames={fieldNames}>
                    {disabledForm}
                </MijnPercelenUploadAnimation>
            ) : uploadState === "animating" && !ANIMATION_ENABLED ? (
                disabledForm
            ) : (
                <Card className="w-full max-w-lg mx-auto">
                    <CardHeader className="space-y-6">
                        <CardTitle>Shapefile uploaden</CardTitle>
                        <Alert>
                            <FlaskConical className="h-4 w-4" />
                            <AlertTitle>Experimentele functie</AlertTitle>
                            <AlertDescription className="text-muted-foreground">
                                Deze functie is nog in ontwikkeling. Laat ons
                                het weten als je feedback hebt!
                            </AlertDescription>
                        </Alert>
                        <CardDescription>
                            Selecteer de bestanden van uw RVO Mijn Percelen
                            export. Zorg ervoor dat u alle bijbehorende
                            bestanden selecteert (.shp, .shx, .dbf, .prj).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <RemixFormProvider {...form}>
                            <Form
                                id="MijnPercelenUploadForm"
                                method="post"
                                encType="multipart/form-data"
                            >
                                <fieldset disabled={isSubmitting}>
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="shapefile"
                                                render={({
                                                    field: {
                                                        name,
                                                        value,
                                                        onBlur,
                                                        ref,
                                                    },
                                                }) => (
                                                    <FormItem>
                                                        <div>Shapefile</div>
                                                        <Dropzone
                                                            ref={ref}
                                                            name={name}
                                                            value={value}
                                                            accept={
                                                                requiredExtensions
                                                            }
                                                            maxSize={
                                                                fileSizeLimit
                                                            }
                                                            multiple
                                                            onBlur={onBlur}
                                                            onFilesChange={
                                                                handleFilesSet
                                                            }
                                                            className={cn(
                                                                hasAllRequiredFiles &&
                                                                    "border-green-500 bg-green-50",
                                                                uploadState ===
                                                                    "error" &&
                                                                    "border-red-500 bg-red-50",
                                                                uploadState ===
                                                                    "success" &&
                                                                    "border-green-500 bg-green-50",
                                                            )}
                                                            mergeFiles={(
                                                                oldFiles,
                                                                newFiles,
                                                            ) =>
                                                                mergeShapefileParts(
                                                                    oldFiles,
                                                                    newFiles,
                                                                    requiredExtensions,
                                                                )
                                                            }
                                                        >
                                                            <FileUp className="w-8 h-8 mb-2 text-muted-foreground" />
                                                            <div className="text-sm text-muted-foreground">
                                                                {selectedFiles.length >
                                                                0
                                                                    ? selectedFiles
                                                                          .map(
                                                                              (
                                                                                  file,
                                                                              ) =>
                                                                                  file.name,
                                                                          )
                                                                          .join(
                                                                              ", ",
                                                                          )
                                                                    : "Klik om te uploaden of sleep de bestanden hierheen"}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                {/* .shp,
                                                                                .shx,
                                                                                .dbf,
                                                                                .prj */}
                                                            </div>
                                                            <RequiredFilesStatus
                                                                files={
                                                                    selectedFiles
                                                                }
                                                                requiredExtensions={
                                                                    requiredExtensions
                                                                }
                                                            />
                                                            {uploadState ===
                                                                "success" && (
                                                                <>
                                                                    <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                                                                    <div className="text-sm text-green-600">
                                                                        Uploaden
                                                                        succesvol!
                                                                    </div>
                                                                </>
                                                            )}
                                                            {uploadState ===
                                                                "error" && (
                                                                <>
                                                                    <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
                                                                    <div className="text-sm text-red-600">
                                                                        Uploaden
                                                                        mislukt.
                                                                        Probeer
                                                                        het
                                                                        opnieuw.
                                                                    </div>
                                                                </>
                                                            )}
                                                        </Dropzone>
                                                        <FormDescription />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <Button
                                                type="submit"
                                                className="w-full"
                                                disabled={
                                                    isSubmitting ||
                                                    !hasAllRequiredFiles
                                                }
                                            >
                                                {isSubmitting ? (
                                                    <div className="flex items-center space-x-2">
                                                        <Spinner />
                                                        <span>Uploaden...</span>
                                                    </div>
                                                ) : (
                                                    "Uploaden"
                                                )}
                                            </Button>
                                            <NavLink
                                                to={`/farm/create/${b_id_farm}/${calendar}`}
                                                className="w-full"
                                            >
                                                <Button
                                                    className="w-full"
                                                    variant={"outline"}
                                                    disabled={isSubmitting}
                                                >
                                                    Terug
                                                </Button>
                                            </NavLink>
                                        </div>
                                    </div>
                                </fieldset>
                            </Form>
                        </RemixFormProvider>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function RequiredFilesStatus({
    files,
    requiredExtensions,
}: {
    files: File[]
    requiredExtensions: string[]
}) {
    const uploadedExtensions = new Set(
        files.map((file) => getFileExtension(file.name)),
    )

    return (
        <div className="grid grid-cols-4 gap-x-4 mt-2 text-xs text-muted-foreground">
            {requiredExtensions.map((ext) => {
                const isUploaded = uploadedExtensions.has(ext)
                return (
                    <div
                        key={ext}
                        className={`flex items-center ${isUploaded ? "text-green-500" : "text-gray-500"}`}
                    >
                        {isUploaded ? (
                            <CheckCircle className="w-4 h-4 mr-1" />
                        ) : (
                            <Circle className="w-4 h-4 mr-1" />
                        )}
                        <span>{ext}</span>
                    </div>
                )
            })}
        </div>
    )
}

const fileSizeLimit = 5 * 1024 * 1024 // 5MB
export const FormSchema = z.object({
    shapefile: z
        .array(z.instanceof(File))
        .refine(
            (files) =>
                files.every(
                    (file) => file.size > 0 && file.size <= fileSizeLimit,
                ),
            {
                error: "Een of meerdere bestanden zijn ongeldig of te groot.",
            },
        )
        .refine(
            (files) => {
                const validMimeTypes = [
                    "application/octet-stream", // Common for .shp, .shx, .dbf
                    "application/x-dbf", // .dbf files
                    "text/plain", // .prj files
                ]
                return files.every(
                    (file) =>
                        validMimeTypes.includes(file.type) || file.type === "",
                )
            },
            {
                error: "Een of meerdere bestanden hebben een ongeldig bestandstype.",
            },
        )
        .refine(
            (files) => {
                const extensions = files.map((file) =>
                    getFileExtension(file.name),
                )
                return [".shp", ".shx", ".dbf", ".prj"].every((ext) =>
                    extensions.includes(ext),
                )
            },
            {
                error: "Zorg ervoor dat u een .shp, .shx, .dbf, en .prj bestand selecteert.",
            },
        ),
})

const getFileExtension = (filename: string): string => {
    return filename.slice(filename.lastIndexOf(".")).toLowerCase()
}

function mergeShapefileParts(
    currentFiles: File[],
    newFiles: File[],
    requiredExtensions: string[],
) {
    const newExtensions = new Set(
        newFiles.map((file) => getFileExtension(file.name)),
    )
    const hasAllRequired = requiredExtensions.every((ext) =>
        newExtensions.has(ext),
    )

    if (hasAllRequired) {
        return [...newFiles]
    }

    const updatedFiles = [...currentFiles]
    newFiles.forEach((newFile) => {
        const newFileExt = getFileExtension(newFile.name)
        const existingFileIndex = updatedFiles.findIndex(
            (file) => getFileExtension(file.name) === newFileExt,
        )
        if (existingFileIndex !== -1) {
            updatedFiles[existingFileIndex] = newFile
        } else {
            updatedFiles.push(newFile)
        }
    })

    return updatedFiles.reduce((acc, current) => {
        if (!acc.find((item) => item.name === current.name)) {
            acc.push(current)
        }
        return acc
    }, [] as File[])
}
