import { format, formatISO } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { Camera } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { NavLink, useFetcher } from "react-router"
import { toast } from "sonner"
import {
  BCS_SELECTED_CLASSES,
  formatIndicatorScore,
  indicatorScoreColor,
} from "~/components/blocks/soil-visual/bcs-color-utils"
import { createTempId, PhotoUploadButton } from "~/components/blocks/soil-visual/bcs-photo-upload"
import { BcsScoreCard } from "~/components/blocks/soil-visual/bcs-score-card"
import { BCS_GUIDES } from "~/components/blocks/soil-visual/bcs-scoring-guide"
import { ImageGallery } from "~/components/blocks/soil-visual/image-gallery"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
  type AnnotationCoords,
  type AnnotationType,
  BCS_FIELD_INDICATORS,
  BCS_VISUAL_KEYS,
  type BcsPreviewResult,
  type BcsVisualKey,
} from "~/lib/bcs"
import { uploadBcsImage } from "~/lib/bcs-image-upload.client"
import { cn } from "~/lib/utils"

interface EditImage {
  tempId: string
  existingId?: string
  objectKey?: string
  url: string
  caption?: string
}

interface EditAnnotation {
  tempId: string
  existingId?: string
  tempImageId: string
  type: AnnotationType
  coordinates: AnnotationCoords
  text?: string
  bcsIndicator?: BcsVisualKey
}

interface BcsEditFormProps {
  a_id: string
  b_id: string
  b_id_farm: string | undefined
  fieldName: string
  labAnalysisDate: Date | string | null
  samplingDate: string
  scores: Partial<Record<BcsVisualKey, 0 | 1 | 2>>
  images: Array<{
    id: string
    url: string
    caption?: string
    annotations: Array<{
      id: string
      type: AnnotationType
      coordinates: AnnotationCoords
      text?: string
      bcsIndicator?: BcsVisualKey
    }>
  }>
}

export function BcsEditForm({
  b_id,
  fieldName,
  labAnalysisDate,
  samplingDate: initialSamplingDate,
  scores: initialScores,
  images: initialImages,
}: BcsEditFormProps) {
  const fetcher = useFetcher()
  const previewFetcher = useFetcher<BcsPreviewResult>()
  const [samplingDate, setSamplingDate] = useState<Date>(() => new Date(initialSamplingDate))
  const [scores, setScores] = useState<Partial<Record<BcsVisualKey, 0 | 1 | 2>>>(initialScores)
  const [images, setImages] = useState<EditImage[]>(() =>
    initialImages.map((image) => ({
      tempId: image.id,
      existingId: image.id,
      url: image.url,
      caption: image.caption,
    })),
  )
  const [annotations, setAnnotations] = useState<EditAnnotation[]>(() =>
    initialImages.flatMap((image) =>
      image.annotations.map((annotation) => ({
        tempId: annotation.id,
        existingId: annotation.id,
        tempImageId: image.id,
        type: annotation.type,
        coordinates: annotation.coordinates,
        text: annotation.text,
        bcsIndicator: annotation.bcsIndicator,
      })),
    ),
  )
  const [isUploading, setIsUploading] = useState(false)

  const isSubmitting = fetcher.state !== "idle"
  const hasAnyVisualScore = BCS_VISUAL_KEYS.some((key) => scores[key] != null)
  const dateKey = format(samplingDate, "yyyy-MM-dd")

  // Refresh the server-side score preview after the user stops changing inputs
  const { submit: submitPreview } = previewFetcher
  useEffect(() => {
    if (!hasAnyVisualScore) return
    const timer = setTimeout(() => {
      void submitPreview(
        { scores, b_id, samplingDate: formatISO(new Date(dateKey)) },
        { method: "POST", action: "/api/bcs-preview", encType: "application/json" },
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [scores, b_id, dateKey, hasAnyVisualScore, submitPreview])

  const galleryImages = useMemo(
    () =>
      images.map((image) => ({
        id: image.tempId,
        url: image.url,
        caption: image.caption,
        annotations: annotations
          .filter((annotation) => annotation.tempImageId === image.tempId)
          .map((annotation) => ({
            type: annotation.type,
            coordinates: annotation.coordinates,
            text: annotation.text,
            bcsIndicator: annotation.bcsIndicator,
          })),
      })),
    [annotations, images],
  )

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
          } satisfies EditImage
        }),
      )
      setImages((previous) => [...previous, ...uploadedImages])
      toast.success(
        `${uploadedImages.length} foto${uploadedImages.length === 1 ? "" : "'s"} toegevoegd`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload mislukt")
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
    setAnnotations((previous) => [
      ...previous,
      {
        tempId: createTempId(),
        tempImageId: imageId,
        type,
        coordinates: coords,
        text: text || undefined,
        bcsIndicator: bcsIndicator as BcsVisualKey | undefined,
      },
    ])
  }

  const handleRemoveAnnotation = (imageId: string, annotationIndex: number) => {
    const annotationToRemove = annotations.filter(
      (annotation) => annotation.tempImageId === imageId,
    )[annotationIndex]
    if (!annotationToRemove) return

    setAnnotations((previous) =>
      previous.filter((annotation) => annotation.tempId !== annotationToRemove.tempId),
    )
  }

  const handleRemoveImage = (imageId: string) => {
    setImages((previous) => previous.filter((image) => image.tempId !== imageId))
    setAnnotations((previous) =>
      previous.filter((annotation) => annotation.tempImageId !== imageId),
    )
  }

  const handleSubmit = () => {
    if (!hasAnyVisualScore) {
      toast.error("Geef minimaal één indicator voor BodemConditieScore op.")
      return
    }

    void fetcher.submit(
      JSON.stringify({
        a_date: dateKey,
        b_sampling_date: dateKey,
        scores,
        images: images.map(({ url: _url, ...image }) => image),
        annotations,
      }),
      { method: "POST", encType: "application/json" },
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>BodemConditieScore bewerken voor {fieldName}</CardTitle>
            <CardDescription>
              Pas de beoordelingsdatum, scores, foto&apos;s en notities aan en sla de wijzigingen
              op.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <DatePicker
              label="Datum bemonstering"
              description="Datum waarop de beoordeling is uitgevoerd."
              field={{
                value: formatISO(samplingDate),
                onChange: (value: string | null) => {
                  if (value) setSamplingDate(new Date(value))
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
            {labAnalysisDate ? (
              <p className="text-muted-foreground text-sm">
                pH en organische stof zijn afgeleid uit de labanalyse van{" "}
                {format(new Date(labAnalysisDate), "PPP", { locale: nl })}.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {BCS_FIELD_INDICATORS.map((indicator) => {
          const guide = BCS_GUIDES.find((item) => item.key === indicator.key)
          if (!guide) return null
          return (
            <Card key={indicator.key}>
              <CardHeader>
                <CardTitle className="text-base">{indicator.name}</CardTitle>
                <CardDescription>{indicator.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {guide.criteria.map((criterion) => {
                  const selected = scores[indicator.key] === criterion.score
                  const bcsColor = indicatorScoreColor(criterion.score, indicator.direction)
                  return (
                    <button
                      key={criterion.score}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setScores((previous) => {
                          const next = { ...previous }
                          if (selected) delete next[indicator.key]
                          else next[indicator.key] = criterion.score
                          return next
                        })
                      }
                      className={cn(
                        "hover:bg-accent w-full rounded-xl border-2 p-3 text-left transition-colors",
                        selected ? BCS_SELECTED_CLASSES[bcsColor] : "border-border bg-background",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{criterion.label}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          Score {formatIndicatorScore(criterion.score, indicator.direction)}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm">{criterion.description}</p>
                    </button>
                  )
                })}
                {scores[indicator.key] != null ? (
                  <p className="text-muted-foreground text-xs">
                    Klik opnieuw op de gekozen score om deze indicator leeg te maken.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="size-4" />
                  Foto&apos;s en notities
                </CardTitle>
                <CardDescription>
                  Voeg foto&apos;s toe, klik op een foto om notities te plaatsen of verwijder
                  foto&apos;s.
                </CardDescription>
              </div>
              <PhotoUploadButton
                onFiles={uploadFiles}
                isUploading={isUploading}
                size="sm"
                label={isUploading ? "Uploaden..." : "Foto toevoegen"}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ImageGallery
              images={galleryImages}
              editMode={true}
              onAddAnnotation={handleAddAnnotation}
              onRemoveAnnotation={handleRemoveAnnotation}
              onRemoveImage={handleRemoveImage}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {hasAnyVisualScore && previewFetcher.data ? (
          <BcsScoreCard
            scores={scores}
            a_ph_bcs={previewFetcher.data.a_ph_bcs}
            a_som_bcs={previewFetcher.data.a_som_bcs}
            d_bcs={previewFetcher.data.d_bcs}
            i_bcs={previewFetcher.data.i_bcs}
            scoreColor={previewFetcher.data.scoreColor}
            scoreLabel={previewFetcher.data.scoreLabel}
          />
        ) : (
          <div className="text-muted-foreground rounded-xl border p-4 text-sm">
            Vul minimaal één visuele indicator in om de score te zien.
          </div>
        )}
      </div>

      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-20 -mx-1 border-t px-1 py-3 backdrop-blur lg:col-span-2">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            asChild
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full px-8 text-base sm:w-auto"
          >
            <NavLink to=".." relative="path">
              Annuleren
            </NavLink>
          </Button>
          <Button
            type="button"
            size="lg"
            className="h-12 w-full px-8 text-base sm:w-auto"
            disabled={isSubmitting || isUploading || !hasAnyVisualScore}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Opslaan..." : "Wijzigingen opslaan"}
          </Button>
        </div>
      </div>
    </div>
  )
}
