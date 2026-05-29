import { ArrowLeft, ArrowRight, Camera, CheckCircle2, ChevronDown, ChevronUp, ImageIcon, Upload } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Form, useFetcher } from "react-router"
import {
    BCS_INDICATORS,
    type BcsIndicatorKey,
} from "~/components/blocks/soil-visual/bcs-color-utils"
import { ScoreButton } from "~/components/blocks/soil-visual/score-button"
import { WizardProgress } from "~/components/blocks/soil-visual/wizard-progress"
import { getScoringGuide } from "~/components/blocks/soil-visual/bcs-scoring-guide"
import { SoilAnnotator } from "~/components/blocks/soil-visual/soil-annotator"
import { Dropzone } from "~/components/custom/dropzone"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.heic"

interface BcsWizardProps {
    b_id: string
    b_id_farm: string
    calendar: string
    action: string
}

interface DraftResponse {
    a_id: string
    b_id_sampling: string | null
}

interface WizardImage {
    a_id_image: string
    a_image_url: string
    annotations: { a_id_annotation: string; a_image_annotation_type: string; a_image_annotation_coordinates: unknown }[]
    a_image_type: string | null
    a_image_caption: string | null
}

const FIELD_INDICATORS = BCS_INDICATORS.filter((indicator) => indicator.source === "field")

/** Step indices: 0=photos, 1=annotate (conditional), then scoring steps, then summary */
function getStepConfig(hasImages: boolean) {
    const steps: { type: "photos" | "annotate" | "score" | "summary"; indicatorIndex?: number }[] = []
    steps.push({ type: "photos" })
    if (hasImages) {
        steps.push({ type: "annotate" })
    }
    for (let i = 0; i < FIELD_INDICATORS.length; i++) {
        steps.push({ type: "score", indicatorIndex: i })
    }
    steps.push({ type: "summary" })
    return steps
}

export function BcsWizard({ b_id, b_id_farm, calendar, action }: BcsWizardProps) {
    const [step, setStep] = useState(0)
    const [a_date, setADate] = useState(new Date())
    const [scores, setScores] = useState<Partial<Record<BcsIndicatorKey, 0 | 1 | 2>>>({})
    const [draftId, setDraftId] = useState<string | null>(null)
    const [b_id_sampling, setBIdSampling] = useState<string | null>(null)
    const [images, setImages] = useState<WizardImage[]>([])
    const [uploading, setUploading] = useState(false)
    const [pendingFile, setPendingFile] = useState<File | null>(null)
    const [guideExpanded, setGuideExpanded] = useState(false)
    const [annotatingImageIndex, setAnnotatingImageIndex] = useState(0)
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const createDraftFetcher = useFetcher<DraftResponse>()

    const hasImages = images.length > 0
    const stepConfig = useMemo(() => getStepConfig(hasImages), [hasImages])
    const totalSteps = stepConfig.length
    const currentStepConfig = stepConfig[step] ?? stepConfig[stepConfig.length - 1]

    const stepLabel = useMemo(() => {
        if (currentStepConfig.type === "photos") return "Foto's uploaden"
        if (currentStepConfig.type === "annotate") return "Foto's annoteren"
        if (currentStepConfig.type === "summary") return "Samenvatting"
        if (currentStepConfig.type === "score" && currentStepConfig.indicatorIndex != null) {
            return FIELD_INDICATORS[currentStepConfig.indicatorIndex]?.name ?? "BCS"
        }
        return "BCS"
    }, [currentStepConfig])

    useEffect(() => {
        if (createDraftFetcher.data?.a_id) {
            setDraftId(createDraftFetcher.data.a_id)
            setBIdSampling(createDraftFetcher.data.b_id_sampling)
        }
    }, [createDraftFetcher.data])

    useEffect(() => {
        if (!pendingFile || !b_id_sampling || uploading) return
        const file = pendingFile
        setPendingFile(null)
        void uploadImage(file, b_id_sampling)
    }, [b_id_sampling, pendingFile, uploading])

    const createDraft = () => {
        if (draftId || createDraftFetcher.state !== "idle") return
        const formData = new FormData()
        formData.append("intent", "create-draft")
        formData.append("b_id", b_id)
        formData.append("b_id_farm", b_id_farm)
        formData.append("calendar", calendar)
        createDraftFetcher.submit(formData, { method: "post", action })
    }

    const uploadImage = async (file: File, samplingId: string) => {
        setUploading(true)
        try {
            const { uploadSoilImage } = await import("~/lib/image-upload.client")
            const a_id_image = await uploadSoilImage(file, samplingId)
            const objectUrl = URL.createObjectURL(file)
            setImages((current) => [
                ...current,
                {
                    a_id_image,
                    a_image_url: objectUrl,
                    annotations: [],
                    a_image_type: null,
                    a_image_caption: null,
                },
            ])
        } catch (error) {
            console.error("Upload failed", error)
        } finally {
            setUploading(false)
        }
    }

    const handleCapture = async (file: File) => {
        if (!b_id_sampling) {
            setPendingFile(file)
            createDraft()
            return
        }
        await uploadImage(file, b_id_sampling)
    }

    const handleScoreChange = (key: BcsIndicatorKey, value: 0 | 1 | 2) => {
        setScores((current) => ({
            ...current,
            [key]: current[key] === value ? undefined : value,
        }))
    }

    const handleAnnotationAdd = (imageIndex: number, annotation: {
        type: string
        data_json: string
        text?: string
        a_image_annotation_bcs?: string
    }) => {
        setImages((current) =>
            current.map((img, i) =>
                i === imageIndex
                    ? {
                          ...img,
                          annotations: [
                              ...img.annotations,
                              {
                                  a_id_annotation: `local-${Date.now()}`,
                                  a_image_annotation_type: annotation.type,
                                  a_image_annotation_coordinates: JSON.parse(annotation.data_json),
                              },
                          ],
                      }
                    : img,
            ),
        )

        // Persist annotation to server if we have a draft
        if (draftId) {
            const fd = new FormData()
            fd.append("intent", "add-annotation")
            fd.append("a_id_image", images[imageIndex].a_id_image)
            fd.append("a_image_annotation_type", annotation.type)
            fd.append("a_image_annotation_coordinates", annotation.data_json)
            if (annotation.text) fd.append("a_image_annotation", annotation.text)
            if (annotation.a_image_annotation_bcs) fd.append("a_image_annotation_bcs", annotation.a_image_annotation_bcs)
            createDraftFetcher.submit(fd, { method: "post", action })
        }
    }

    const next = () => setStep((current) => Math.min(current + 1, totalSteps - 1))
    const prev = () => setStep((current) => Math.max(current - 1, 0))

    // ─── Photo Upload Step ───────────────────────────────────────────────
    if (currentStepConfig.type === "photos") {
        return (
            <div className="space-y-6">
                <WizardProgress currentStep={step} totalSteps={totalSteps} stepLabel={stepLabel} />

                <div className="rounded-xl border p-6 space-y-4">
                    <div className="space-y-2">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Camera className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-semibold">Foto's uploaden</h3>
                            <p className="text-sm text-muted-foreground">
                                Maak of upload foto's van het bodemprofiel. Je kunt later annotaties toevoegen om observaties te markeren.
                            </p>
                        </div>
                    </div>

                    <Dropzone
                        name="images"
                        accept={IMAGE_ACCEPT}
                        multiple
                        disabled={uploading || createDraftFetcher.state !== "idle"}
                        allowReset={false}
                        onFilesChange={(files) => {
                            for (const file of files) {
                                void handleCapture(file)
                            }
                        }}
                    >
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            Sleep foto's hierheen of{" "}
                            <span className="text-primary underline-offset-4 hover:underline">blader</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            JPG, PNG, WEBP of HEIC — max. 10 MB
                        </p>
                    </Dropzone>

                    {/* Camera capture — mobile only */}
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) void handleCapture(file)
                            e.target.value = ""
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:hidden"
                        disabled={uploading || createDraftFetcher.state !== "idle"}
                        onClick={() => {
                            if (!b_id_sampling) createDraft()
                            cameraInputRef.current?.click()
                        }}
                    >
                        <Camera className="mr-2 h-4 w-4" />
                        Foto maken
                    </Button>

                    {/* Image thumbnails */}
                    {images.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                            {images.map((img) => (
                                <div key={img.a_id_image} className="aspect-square rounded-md overflow-hidden border bg-muted">
                                    <img src={img.a_image_url} alt="" className="h-full w-full object-cover" />
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-sm">
                        <span className="font-medium">{images.length} foto's toegevoegd</span>
                        <span className="text-muted-foreground">
                            {uploading
                                ? "Uploaden..."
                                : createDraftFetcher.state !== "idle"
                                  ? "Klaarzetten..."
                                  : "Foto's zijn optioneel"}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <Button type="button" variant="ghost" onClick={next}>
                        Overslaan
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button type="button" onClick={next}>
                        Volgende
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        )
    }

    // ─── Annotation Step (only if images uploaded) ───────────────────────
    if (currentStepConfig.type === "annotate") {
        const currentImage = images[annotatingImageIndex]

        return (
            <div className="space-y-6">
                <WizardProgress currentStep={step} totalSteps={totalSteps} stepLabel={stepLabel} />

                <div className="rounded-xl border p-6 space-y-4">
                    <div className="space-y-2">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <ImageIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-semibold">Foto's annoteren</h3>
                            <p className="text-sm text-muted-foreground">
                                Markeer observaties op je foto's met pins, cirkels of pijlen. Koppel annotaties aan BCS-indicatoren. Je kunt dit ook overslaan.
                            </p>
                        </div>
                    </div>

                    {/* Image selector */}
                    {images.length > 1 && (
                        <div className="flex gap-2">
                            {images.map((img, i) => (
                                <button
                                    key={img.a_id_image}
                                    type="button"
                                    onClick={() => setAnnotatingImageIndex(i)}
                                    className={cn(
                                        "h-16 w-16 rounded-md overflow-hidden border-2 transition-colors",
                                        i === annotatingImageIndex ? "border-primary" : "border-transparent",
                                    )}
                                >
                                    <img src={img.a_image_url} alt="" className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Annotation canvas */}
                    {currentImage && (
                        <SoilAnnotator
                            imageUrl={currentImage.a_image_url}
                            annotations={currentImage.annotations.map((a) => ({
                                ...a,
                                a_image_annotation: null,
                                a_image_annotation_bcs: null,
                                a_image_annotation_order: 0,
                                a_id_image: currentImage.a_id_image,
                                created: new Date().toISOString(),
                                updated: new Date().toISOString(),
                            })) as unknown as Parameters<typeof SoilAnnotator>[0]["annotations"]}
                            onAnnotationAdd={(ann) => handleAnnotationAdd(annotatingImageIndex, ann)}
                        />
                    )}
                </div>

                <div className="flex items-center justify-between gap-3">
                    <Button type="button" variant="outline" onClick={prev}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Vorige
                    </Button>
                    <Button type="button" onClick={next}>
                        Volgende
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        )
    }

    // ─── Scoring Steps ───────────────────────────────────────────────────
    if (currentStepConfig.type === "score" && currentStepConfig.indicatorIndex != null) {
        const indicator = FIELD_INDICATORS[currentStepConfig.indicatorIndex]
        const isPositive = indicator.direction === "positive"
        const guide = getScoringGuide(indicator.key)

        return (
            <div className="space-y-6">
                <WizardProgress currentStep={step} totalSteps={totalSteps} stepLabel={stepLabel} />

                <div className="rounded-xl border p-6 space-y-6">
                    {/* Indicator header */}
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span
                                className={cn(
                                    "rounded-full px-3 py-1 font-medium",
                                    isPositive
                                        ? "bg-green-100 text-green-700"
                                        : "bg-orange-100 text-orange-700",
                                )}
                            >
                                {isPositive ? "Positief" : "Negatief"}
                            </span>
                            <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                                Gewicht ×{indicator.weight}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-2xl font-semibold">{indicator.name}</h3>
                            <p className="text-sm text-muted-foreground">{indicator.description}</p>
                        </div>
                    </div>

                    {/* Scoring guide */}
                    {guide && (
                        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                            <button
                                type="button"
                                onClick={() => setGuideExpanded(!guideExpanded)}
                                className="flex w-full items-center justify-between text-sm font-medium"
                            >
                                <span>📋 Beoordelingsrichtlijn</span>
                                {guideExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </button>

                            {guideExpanded && (
                                <div className="space-y-3 pt-2">
                                    <p className="text-sm text-muted-foreground italic">
                                        {guide.instruction}
                                    </p>
                                    <div className="space-y-2">
                                        {guide.scoreLevels.map((level) => (
                                            <div
                                                key={level.score}
                                                className={cn(
                                                    "flex gap-3 rounded-md border p-3 text-sm transition-colors",
                                                    scores[indicator.key] === level.score && "border-primary bg-primary/5",
                                                )}
                                            >
                                                <span className="shrink-0 font-bold text-base w-6 text-center">
                                                    {level.score}
                                                </span>
                                                <div>
                                                    <span className="font-medium">{level.label}</span>
                                                    <p className="text-muted-foreground">{level.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Score buttons */}
                    <div className="flex gap-3">
                        {[0, 1, 2].map((value) => (
                            <ScoreButton
                                key={value}
                                value={value}
                                selected={scores[indicator.key] === value}
                                onClick={() => handleScoreChange(indicator.key, value as 0 | 1 | 2)}
                            />
                        ))}
                    </div>

                    {/* User's own photos as reference (thumbnails) */}
                    {images.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Je foto's ter referentie</p>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {images.map((img) => (
                                    <div key={img.a_id_image} className="h-16 w-16 shrink-0 rounded-md overflow-hidden border bg-muted">
                                        <img src={img.a_image_url} alt="" className="h-full w-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3">
                    <Button type="button" variant="outline" onClick={prev}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Vorige
                    </Button>
                    <Button type="button" onClick={next}>
                        Volgende
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        )
    }

    // ─── Summary Step ────────────────────────────────────────────────────
    const scoredCount = Object.values(scores).filter((v) => v != null).length
    const fieldIndicatorCount = FIELD_INDICATORS.length

    return (
        <div className="space-y-6">
            <WizardProgress currentStep={step} totalSteps={totalSteps} stepLabel={stepLabel} />

            <div className="rounded-xl border p-6 space-y-6">
                <div className="space-y-2">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-semibold">Samenvatting</h3>
                        <p className="text-sm text-muted-foreground">
                            Controleer de datum en scores, en sla de BCS-beoordeling op. De totaalscore wordt na opslaan berekend.
                        </p>
                    </div>
                </div>

                {/* Scores overview */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <p className="text-sm font-medium">
                        {scoredCount} van {fieldIndicatorCount} indicatoren beoordeeld
                    </p>
                    <div className="space-y-1">
                        {FIELD_INDICATORS.map((indicator) => {
                            const score = scores[indicator.key]
                            return (
                                <div key={indicator.key} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{indicator.name}</span>
                                    <span className="font-medium">
                                        {score != null ? score : "—"}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="a_date" className="text-sm font-medium">
                        Datum
                    </label>
                    <input
                        id="a_date"
                        type="date"
                        value={a_date.toISOString().split("T")[0]}
                        onChange={(event) => {
                            if (!event.target.value) return
                            setADate(new Date(`${event.target.value}T12:00:00`))
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                </div>

                {/* Uploaded images summary */}
                {images.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium">{images.length} foto's</p>
                        <div className="grid grid-cols-4 gap-2">
                            {images.map((img) => (
                                <div key={img.a_id_image} className="aspect-square rounded-md overflow-hidden border bg-muted">
                                    <img src={img.a_image_url} alt="" className="h-full w-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={prev}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Vorige
                </Button>

                <Form method="post" action={action}>
                    {draftId && <input type="hidden" name="a_id" value={draftId} />}
                    <input type="hidden" name="intent" value="save" />
                    <input type="hidden" name="b_id" value={b_id} />
                    <input type="hidden" name="b_id_farm" value={b_id_farm} />
                    <input type="hidden" name="calendar" value={calendar} />
                    <input type="hidden" name="a_date" value={a_date.toISOString()} />
                    {Object.entries(scores).map(([key, value]) =>
                        value != null ? (
                            <input key={key} type="hidden" name={key} value={String(value)} />
                        ) : null,
                    )}
                    <Button type="submit">Opslaan</Button>
                </Form>
            </div>
        </div>
    )
}
