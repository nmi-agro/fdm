import { format, formatISO } from "date-fns"
import { nl } from "date-fns/locale/nl"
import {
    Camera,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Upload,
} from "lucide-react"
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { useFetcher } from "react-router"
import { toast } from "sonner"
import {
    BCS_SELECTED_CLASSES,
    indicatorScoreColor,
} from "~/components/blocks/soil-visual/bcs-color-utils"
import { BcsScoreCard } from "~/components/blocks/soil-visual/bcs-score-card"
import { BCS_GUIDES } from "~/components/blocks/soil-visual/bcs-scoring-guide"
import { ImageGallery } from "~/components/blocks/soil-visual/image-gallery"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Progress } from "~/components/ui/progress"
import { Separator } from "~/components/ui/separator"
import {
    type AnnotationCoords,
    type AnnotationType,
    BCS_FIELD_INDICATORS,
    BCS_VISUAL_KEYS,
    type BcsPreviewResult,
    type BcsSavePayload,
    type BcsVisualKey,
    type WizardAnnotation,
    type WizardImage,
} from "~/lib/bcs"
import { uploadBcsImage } from "~/lib/bcs-image-upload.client"
import { cn } from "~/lib/utils"

interface PhotoUploadButtonProps {
    onFiles: (files: FileList) => void
    disabled?: boolean
    size?: "sm" | "lg"
    label?: string
}

/** On mobile shows a single button with a dropdown (Camera / Galerij).
 *  On desktop shows a regular file-picker button. */
function PhotoUploadButton({
    onFiles,
    disabled,
    size = "lg",
    label = "Foto's kiezen",
}: PhotoUploadButtonProps) {
    const cameraRef = useRef<HTMLInputElement>(null)
    const galleryRef = useRef<HTMLInputElement>(null)

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
        if (e.target.files?.length) {
            onFiles(e.target.files)
            e.target.value = ""
        }
    }

    return (
        <>
            {/* Hidden inputs — shared by both mobile and desktop */}
            <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={disabled}
                onChange={handleChange}
            />
            <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={disabled}
                onChange={handleChange}
            />

            {/* Mobile: single button → dropdown */}
            <div className="sm:hidden">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" size={size} disabled={disabled}>
                            <Camera className="size-4" />
                            {label}
                            <ChevronDown className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onSelect={() => cameraRef.current?.click()}
                        >
                            <Camera className="size-4" />
                            Camera
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => galleryRef.current?.click()}
                        >
                            <Upload className="size-4" />
                            Galerij kiezen
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Desktop: regular file-picker */}
            <div className="hidden sm:block">
                <Button type="button" size={size} disabled={disabled} asChild>
                    <label className="cursor-pointer">
                        <Upload className="size-4" />
                        {disabled ? "Uploaden..." : label}
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={disabled}
                            onChange={handleChange}
                        />
                    </label>
                </Button>
            </div>
        </>
    )
}

interface BcsWizardProps {
    b_id: string
    fieldName: string
    labAnalysisDate: Date | null
    somLoi: number | null
    phCc: number | null
    soilSource: string | null
}

function createTempId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID()
    }
    return `tmp-${Math.random().toString(36).slice(2, 10)}`
}

export function BcsWizard({
    b_id,
    fieldName,
    labAnalysisDate,
    somLoi,
    phCc,
    soilSource,
}: BcsWizardProps) {
    const fetcher = useFetcher()
    const previewFetcher = useFetcher<BcsPreviewResult>()
    const totalSteps = BCS_FIELD_INDICATORS.length + 2
    const [currentStep, setCurrentStep] = useState(0)
    const [samplingDate, setSamplingDate] = useState<Date>(new Date())
    const [scores, setScores] = useState<
        Partial<Record<BcsVisualKey, 0 | 1 | 2>>
    >({})
    const [images, setImages] = useState<WizardImage[]>([])
    const [annotations, setAnnotations] = useState<WizardAnnotation[]>([])
    const [isUploading, setIsUploading] = useState(false)

    const isReviewStep = currentStep === totalSteps - 1
    const currentIndicator =
        currentStep > 0 && currentStep <= BCS_FIELD_INDICATORS.length
            ? BCS_FIELD_INDICATORS[currentStep - 1]
            : null
    const currentGuide = currentIndicator
        ? (BCS_GUIDES.find((guide) => guide.key === currentIndicator.key) ??
          null)
        : null
    const hasAnyVisualScore = BCS_VISUAL_KEYS.some((key) => scores[key] != null)

    // Fetch server-side BCS preview whenever the review step is entered
    useEffect(() => {
        if (!isReviewStep) return
        previewFetcher.submit(
            {
                scores,
                b_id,
                samplingDate: formatISO(samplingDate),
            },
            {
                method: "POST",
                action: "/api/bcs-preview",
                encType: "application/json",
            },
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReviewStep, scores, b_id, samplingDate, previewFetcher.submit])

    const galleryImages = useMemo(
        () =>
            images.map((image) => ({
                id: image.tempId,
                url: image.url,
                caption: image.caption,
                annotations: annotations
                    .filter(
                        (annotation) => annotation.tempImageId === image.tempId,
                    )
                    .map((annotation) => ({
                        type: annotation.type,
                        coordinates: annotation.coordinates,
                        text: annotation.text,
                        bcsIndicator: annotation.bcsIndicator,
                    })),
            })),
        [annotations, images],
    )

    const isSubmitting = fetcher.state !== "idle"

    const uploadFiles = async (fileList: FileList) => {
        const selectedFiles = Array.from(fileList)
        if (selectedFiles.length === 0) return

        setIsUploading(true)
        try {
            const uploadedImages = await Promise.all(
                selectedFiles.map(async (file) => {
                    const result = await uploadBcsImage(file, b_id, file.name)
                    return {
                        tempId: createTempId(),
                        objectKey: result.objectKey,
                        url: result.url,
                        caption: file.name,
                    } satisfies WizardImage
                }),
            )
            setImages((previous) => [...previous, ...uploadedImages])
            toast.success(
                `${uploadedImages.length} foto${uploadedImages.length === 1 ? "" : "'s"} toegevoegd`,
            )
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Upload mislukt",
            )
        } finally {
            setIsUploading(false)
        }
    }

    const handleAddAnnotation = (
        imageId: string,
        type: AnnotationType,
        coords: AnnotationCoords,
        text: string,
        bcsIndicator?: string,
    ) => {
        const indicator =
            (bcsIndicator as BcsVisualKey | undefined) ?? currentIndicator?.key

        setAnnotations((previous) => [
            ...previous,
            {
                tempId: createTempId(),
                tempImageId: imageId,
                type,
                coordinates: coords,
                text: text || undefined,
                bcsIndicator: indicator,
            },
        ])
    }

    const handleRemoveAnnotation = (
        imageId: string,
        annotationIndex: number,
    ) => {
        const annotationToRemove = annotations.filter(
            (annotation) => annotation.tempImageId === imageId,
        )[annotationIndex]

        if (!annotationToRemove) return

        setAnnotations((previous) =>
            previous.filter(
                (annotation) => annotation.tempId !== annotationToRemove.tempId,
            ),
        )
    }

    const handleSubmit = () => {
        if (!hasAnyVisualScore) {
            toast.error(
                "Geef minimaal één indicator voor BodemConditieScore op.",
            )
            return
        }

        const payload: BcsSavePayload = {
            a_date: format(samplingDate, "yyyy-MM-dd"),
            b_sampling_date: format(samplingDate, "yyyy-MM-dd"),
            a_depth_lower: 25,
            scores,
            images,
            annotations,
        }

        fetcher.submit(JSON.stringify(payload), {
            method: "POST",
            encType: "application/json",
        })
    }

    return (
        <Card>
            <CardHeader className="space-y-3 pb-2">
                {/* Step title */}
                <div>
                    {currentStep === 0 ? (
                        <>
                            <CardTitle>
                                BodemConditieScore voor {fieldName}
                            </CardTitle>
                            <CardDescription className="mt-1.5">
                                Leg eerst de beoordelingsdatum vast en voeg
                                optioneel foto&apos;s toe die, waar je later
                                notities aan kunt toevoegen.
                            </CardDescription>
                        </>
                    ) : currentIndicator ? (
                        <>
                            <CardTitle>{currentIndicator.name}</CardTitle>
                            <CardDescription className="mt-1.5">
                                {currentIndicator.description}
                            </CardDescription>
                        </>
                    ) : (
                        <>
                            <CardTitle>Controleer en bevestig</CardTitle>
                            <CardDescription className="mt-1.5">
                                Bekijk het totaal, de deelindicatoren en de
                                foto&apos;s voordat je opslaat.
                            </CardDescription>
                        </>
                    )}
                </div>

                {/* Progress */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                            Stap {currentStep + 1} van {totalSteps}
                        </span>
                        <span>
                            {Math.round(((currentStep + 1) / totalSteps) * 100)}
                            %
                        </span>
                    </div>
                    <Progress
                        value={((currentStep + 1) / totalSteps) * 100}
                        className="h-2"
                    />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {currentStep === 0 ? (
                    <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2 md:items-start">
                            <DatePicker
                                label="Datum bemonstering"
                                description="Datum waarop de beoordeling is uitgevoerd."
                                field={{
                                    value: formatISO(samplingDate),
                                    onChange: (value: string | null) => {
                                        if (value)
                                            setSamplingDate(new Date(value))
                                    },
                                    onBlur: () => {},
                                    disabled: false,
                                    name: "samplingDate",
                                    ref: () => {},
                                }}
                                fieldState={{
                                    invalid: false,
                                    isDirty: false,
                                    isTouched: false,
                                    isValidating: false,
                                    error: undefined,
                                }}
                                required
                            />

                            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
                                <div className="font-medium text-foreground">
                                    pH en organische stof
                                </div>
                                {phCc != null || somLoi != null ? (
                                    <>
                                        <p>
                                            {labAnalysisDate
                                                ? `Labanalyse van ${format(new Date(labAnalysisDate), "PPP", { locale: nl })}`
                                                : "Labanalyse"}
                                            {soilSource
                                                ? ` · ${soilSource}`
                                                : ""}
                                            .
                                        </p>
                                        <p>
                                            pH-CaCl₂:{" "}
                                            <span className="font-medium text-foreground">
                                                {phCc != null
                                                    ? phCc.toFixed(1)
                                                    : "–"}
                                            </span>
                                            {" · "}
                                            OS:{" "}
                                            <span className="font-medium text-foreground">
                                                {somLoi != null
                                                    ? `${somLoi.toFixed(1)} %`
                                                    : "–"}
                                            </span>
                                        </p>
                                    </>
                                ) : (
                                    <p>
                                        Geen recente labanalyse gevonden — pH en
                                        organische stof blijven onbekend.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-dashed p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 font-medium">
                                        <Camera className="size-4" />
                                        Foto&apos;s toevoegen
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Upload profiel-, oppervlakte- of
                                        detailfoto&apos;s voor notities tijdens
                                        de beoordeling.
                                    </p>
                                </div>
                                <PhotoUploadButton
                                    onFiles={uploadFiles}
                                    disabled={isUploading}
                                    size="lg"
                                    label={
                                        isUploading
                                            ? "Uploaden..."
                                            : "Foto's kiezen"
                                    }
                                />
                            </div>
                        </div>

                        <ImageGallery
                            images={galleryImages}
                            editMode={true}
                            onAddAnnotation={handleAddAnnotation}
                            onRemoveAnnotation={handleRemoveAnnotation}
                        />
                    </div>
                ) : currentIndicator && currentGuide ? (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Left: What to assess + how */}
                        <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                            <div>
                                <div className="text-sm font-medium">
                                    Wat beoordeel je?
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {currentGuide.description}
                                </p>
                            </div>
                            <div>
                                <div className="text-sm font-medium">
                                    Werkwijze
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {currentGuide.instructions}
                                </p>
                            </div>
                            <div>
                                <div className="text-sm font-medium">
                                    Fototip
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {currentGuide.tip}
                                </p>
                            </div>
                        </div>

                        {/* Right: Clickable criteria (= score selection) + images */}
                        <div className="space-y-4">
                            <div className="text-sm font-medium">
                                Kies de score
                            </div>
                            <div className="space-y-3">
                                {currentGuide.criteria.map((criterion) => {
                                    const selected =
                                        scores[currentIndicator.key] ===
                                        criterion.score
                                    const bcsColor = indicatorScoreColor(
                                        criterion.score,
                                        currentIndicator.direction,
                                    )

                                    return (
                                        <button
                                            key={criterion.score}
                                            type="button"
                                            onClick={() =>
                                                setScores((previous) => ({
                                                    ...previous,
                                                    [currentIndicator.key]:
                                                        criterion.score,
                                                }))
                                            }
                                            className={cn(
                                                "w-full rounded-xl border-2 p-3 text-left transition-colors hover:bg-accent",
                                                selected
                                                    ? BCS_SELECTED_CLASSES[
                                                          bcsColor
                                                      ]
                                                    : "border-border bg-background",
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">
                                                    {criterion.label}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                                                        selected
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-muted text-muted-foreground",
                                                    )}
                                                >
                                                    Score {criterion.score}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {criterion.description}
                                            </p>
                                        </button>
                                    )
                                })}
                            </div>

                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">
                                    Foto&apos;s en notities
                                </div>
                                <PhotoUploadButton
                                    onFiles={uploadFiles}
                                    disabled={isUploading}
                                    size="sm"
                                    label={
                                        isUploading
                                            ? "Uploaden..."
                                            : "Foto toevoegen"
                                    }
                                />
                            </div>
                            {images.length > 0 ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                        Koppel notities aan deze indicator door
                                        op een foto te klikken.
                                    </p>
                                    <ImageGallery
                                        images={galleryImages}
                                        editMode={true}
                                        onAddAnnotation={handleAddAnnotation}
                                        onRemoveAnnotation={
                                            handleRemoveAnnotation
                                        }
                                        defaultIndicator={currentIndicator.key}
                                    />
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Nog geen foto&apos;s. Voeg foto&apos;s toe
                                    om notities te plaatsen.
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Review step: 2-col on desktop */
                    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
                        <div className="space-y-4">
                            {previewFetcher.state !== "idle" ? (
                                <div className="flex items-center justify-center rounded-xl border bg-muted/20 p-12 text-sm text-muted-foreground">
                                    Score wordt berekend...
                                </div>
                            ) : previewFetcher.data ? (
                                <BcsScoreCard
                                    scores={scores}
                                    a_ph_bcs={previewFetcher.data.a_ph_bcs}
                                    a_som_bcs={previewFetcher.data.a_som_bcs}
                                    d_bcs={previewFetcher.data.d_bcs}
                                    i_bcs={previewFetcher.data.i_bcs}
                                    scoreColor={previewFetcher.data.scoreColor}
                                    scoreLabel={previewFetcher.data.scoreLabel}
                                />
                            ) : null}

                            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                                {hasAnyVisualScore ? (
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                                        <span>
                                            Klaar om op te slaan. Je hebt{" "}
                                            {
                                                BCS_VISUAL_KEYS.filter(
                                                    (key) =>
                                                        scores[key] != null,
                                                ).length
                                            }{" "}
                                            van de {BCS_VISUAL_KEYS.length}{" "}
                                            visuele indicatoren ingevuld.
                                        </span>
                                    </div>
                                ) : (
                                    <span>
                                        Vul minimaal één visuele indicator in
                                        voordat je opslaat.
                                    </span>
                                )}
                            </div>

                            <Button
                                type="button"
                                size="lg"
                                className="w-full"
                                disabled={isSubmitting || !hasAnyVisualScore}
                                onClick={handleSubmit}
                            >
                                {isSubmitting
                                    ? "Opslaan..."
                                    : "Bevestigen en opslaan"}
                            </Button>
                        </div>

                        {images.length > 0 ? (
                            <div className="space-y-3">
                                <div className="text-sm font-medium">
                                    Foto&apos;s en notities
                                </div>
                                <ImageGallery
                                    images={galleryImages}
                                    editMode={true}
                                    onAddAnnotation={handleAddAnnotation}
                                    onRemoveAnnotation={handleRemoveAnnotation}
                                />
                            </div>
                        ) : null}
                    </div>
                )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-between">
                <Button
                    type="button"
                    variant="outline"
                    disabled={currentStep === 0 || isSubmitting}
                    onClick={() =>
                        setCurrentStep((step) => Math.max(0, step - 1))
                    }
                >
                    <ChevronLeft className="size-4" />
                    Terug
                </Button>

                {currentStep < totalSteps - 1 ? (
                    <Button
                        type="button"
                        size="lg"
                        disabled={isSubmitting}
                        onClick={() =>
                            setCurrentStep((step) =>
                                Math.min(totalSteps - 1, step + 1),
                            )
                        }
                    >
                        Volgende
                        <ChevronRight className="size-4" />
                    </Button>
                ) : null}
            </CardFooter>
        </Card>
    )
}
