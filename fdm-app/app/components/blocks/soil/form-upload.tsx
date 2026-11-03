import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, ChevronRight, FileUp } from "lucide-react"
import { useMemo } from "react"
import { Controller, useWatch } from "react-hook-form"
import { Form, NavLink, useNavigation } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { z } from "zod"
import { Dropzone } from "~/components/custom/dropzone"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

/** Laboratories whose PDF reports can be read automatically. */
const SUPPORTED_LABS = [
  "Eurofins Agro",
  "HLB",
  "ALNN",
  "Altic",
  "Dumea",
  "Fertilab",
  "Koch",
  "Roba",
  "SoilTech",
  "Laboratorium Zeeuws-Vlaanderen",
]

/** The steps of adding a soil analysis from a PDF. */
const UPLOAD_STEPS: readonly string[] = ["PDF kiezen", "Uitlezen", "Controleren en opslaan"]

/**
 * Shows the steps of adding a soil analysis from a PDF and which one is current.
 *
 * @param current - Index of the current step.
 * @param steps - The names of the steps; defaults to the steps of adding one PDF.
 */
export function SoilAnalysisUploadSteps({
  current,
  steps = UPLOAD_STEPS,
}: {
  current: number
  steps?: readonly string[]
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Stappen">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          {index > 0 && <ChevronRight aria-hidden className="text-muted-foreground size-3.5" />}
          <span
            className={cn(
              index === current ? "text-foreground font-medium" : "text-muted-foreground",
            )}
            aria-current={index === current ? "step" : undefined}
          >
            {index + 1}. {step}
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * First step of adding a soil analysis from a PDF: choosing the lab report and having it read.
 * Submitting posts the file with `intent=extract`; nothing is saved yet.
 *
 * @param disabled - Whether reading PDFs is unavailable.
 * @param error - Message shown when the previous attempt to read a PDF failed.
 * @param manualEntryHref - Link to the form for entering the values by hand.
 * @param onFileChange - Called with the chosen file, so the next step can show and submit it.
 */
export function SoilAnalysisUploadForm({
  disabled,
  error,
  manualEntryHref,
  onFileChange,
}: {
  disabled?: boolean
  error?: string | null
  manualEntryHref: string
  onFileChange?: (file: File | null) => void
}) {
  const form = useRemixForm<z.infer<typeof FormSchema>>({
    mode: "onTouched",
    resolver: zodResolver(FormSchema),
    defaultValues: { soilAnalysisFile: undefined },
  })

  const selectedFile = useWatch({ control: form.control, name: "soilAnalysisFile" })
  const dropzoneValue = useMemo(() => (selectedFile ? [selectedFile] : []), [selectedFile])

  const navigation = useNavigation()
  const isReading =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "extract"

  const handleFilesChange = (files: File[]) => {
    const file = files[0]
    form.setValue("soilAnalysisFile", file, { shouldValidate: true })
    onFileChange?.(file ?? null)
  }

  return (
    <div className="space-y-4">
      <SoilAnalysisUploadSteps current={isReading ? 1 : 0} />
      <RemixFormProvider {...form}>
        <Form id="soilAnalysisUploadForm" method="post" encType="multipart/form-data">
          <input type="hidden" name="intent" value="extract" />
          <fieldset disabled={isReading || disabled} className="space-y-4">
            <Controller
              name="soilAnalysisFile"
              render={({ field: { name, onBlur, ref }, fieldState }) => (
                <Field>
                  <FieldLabel className="sr-only">PDF-rapport van het lab</FieldLabel>
                  <Dropzone
                    label="Kies het PDF-rapport van het lab of sleep het hierheen"
                    ref={ref}
                    name={name}
                    value={dropzoneValue}
                    accept=".pdf"
                    maxSize={fileSizeLimit}
                    required
                    disabled={disabled || isReading}
                    className="h-36"
                    onBlur={onBlur}
                    onFilesChange={handleFilesChange}
                  >
                    <div className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 px-4 text-center">
                      {isReading ? (
                        <>
                          <Spinner className="mb-1 size-6" />
                          <div className="text-sm font-medium">PDF wordt uitgelezen…</div>
                          <div className="text-muted-foreground text-xs">Dit kan even duren.</div>
                        </>
                      ) : (
                        <>
                          <FileUp className="text-muted-foreground mb-1 size-7" aria-hidden />
                          <div className="text-sm font-medium">
                            {selectedFile
                              ? selectedFile.name
                              : "Kies het PDF-rapport of sleep het hierheen"}
                          </div>
                          <div className="text-muted-foreground text-xs">PDF, maximaal 5 MB</div>
                        </>
                      )}
                    </div>
                  </Dropzone>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div aria-live="polite" className="sr-only">
              {isReading ? "De PDF wordt uitgelezen." : ""}
            </div>
            {error && !isReading && (
              <Alert variant="destructive" role="alert">
                <AlertCircle aria-hidden />
                <AlertTitle>PDF niet uitgelezen</AlertTitle>
                <AlertDescription>
                  <p>{error}</p>
                  <NavLink
                    to={manualEntryHref}
                    className="font-medium underline underline-offset-4"
                  >
                    Analyse handmatig invoeren
                  </NavLink>
                </AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              disabled={isReading || disabled || !selectedFile}
              className="max-sm:w-full pointer-coarse:h-11"
            >
              {isReading ? (
                <>
                  <Spinner />
                  Uitlezen…
                </>
              ) : (
                "PDF uitlezen"
              )}
            </Button>
          </fieldset>
        </Form>
      </RemixFormProvider>
      <p className="text-muted-foreground text-sm">
        Je controleert de uitgelezen waarden voordat de analyse wordt opgeslagen. Ondersteunde labs:{" "}
        {SUPPORTED_LABS.join(", ")}.
      </p>
    </div>
  )
}

const fileSizeLimit = 5 * 1024 * 1024 // 5MB
export const FormSchema = z.object({
  soilAnalysisFile: z
    .instanceof(File, { error: "Kies een PDF-bestand" })
    .refine((file) => ["application/pdf"].includes(file.type), {
      error: "Kies een PDF-bestand",
    })
    .refine((file) => file.size > 0, {
      error: "Dit bestand is leeg",
    })
    .refine((file) => file.size <= fileSizeLimit, {
      error: "Het bestand mag niet groter zijn dan 5 MB",
    }),
})
