import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import { AlertCircle, TriangleAlert } from "lucide-react"
import { type ReactNode, useState } from "react"
import { NavLink, useActionData } from "react-router"
import type { SoilAnalysisReview } from "~/lib/soil-upload.server"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { getObjectUrl } from "~/lib/object-url"
import { SoilAnalysisForm } from "./form"
import { SoilAnalysisUploadForm, SoilAnalysisUploadSteps } from "./form-upload"
import { SAMPLING_PARAMETERS } from "./parameter-groups"

type UploadActionData = { review?: SoilAnalysisReview; uploadError?: string } | null | undefined

/**
 * Adds a soil analysis from a PDF lab report in two steps: the PDF is read first, then the user
 * checks and completes the values next to the PDF and saves them. Nothing is stored until the user
 * saves. Use it on a route whose action is `handleSoilAnalysisUploadAction`.
 *
 * @param soilParameterDescription - Descriptions of all soil parameters.
 * @param disabled - Whether reading PDFs is unavailable.
 * @param manualEntryHref - Link to the form for entering the values by hand.
 * @param heading - Heading shown above the upload step.
 * @param belowUpload - Content shown below the upload step only, such as a link to upload many
 * reports at once; it is hidden while the user checks the values.
 * @param aside - Content shown next to the upload step when there is room (below it otherwise),
 * such as other ways to add an analysis; it is hidden while the user checks the values.
 */
export function SoilAnalysisUploadFlow({
  soilParameterDescription,
  disabled,
  manualEntryHref,
  heading,
  belowUpload,
  aside,
}: {
  soilParameterDescription: SoilParameterDescription
  disabled?: boolean
  manualEntryHref: string
  heading?: ReactNode
  belowUpload?: ReactNode
  aside?: ReactNode
}) {
  const actionData = useActionData<UploadActionData>()
  const [file, setFile] = useState<File | null>(null)
  const [dismissedReviewId, setDismissedReviewId] = useState<string | null>(null)

  const review = actionData?.review
  if (review && file && review.id !== dismissedReviewId) {
    return (
      <SoilAnalysisReviewStep
        key={review.id}
        review={review}
        file={file}
        soilParameterDescription={soilParameterDescription}
        onChooseOtherFile={() => {
          setDismissedReviewId(review.id)
          setFile(null)
        }}
      />
    )
  }

  const upload = (
    <div className="space-y-6">
      {heading}
      <SoilAnalysisUploadForm
        disabled={disabled}
        error={actionData?.uploadError}
        manualEntryHref={manualEntryHref}
        onFileChange={setFile}
      />
      {belowUpload}
    </div>
  )

  if (!aside) {
    return <div className="max-w-3xl">{upload}</div>
  }

  // The upload and the alternatives side by side when the page is wide enough
  return (
    <div className="@container">
      <div className="grid gap-10 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:gap-12">
        {upload}
        {aside}
      </div>
    </div>
  )
}

/**
 * Second step of adding a soil analysis from a PDF: the PDF next to a form prefilled with the values
 * read from it. Required values that were not found are listed so the user can add them.
 */
function SoilAnalysisReviewStep({
  review,
  file,
  soilParameterDescription,
  onChooseOtherFile,
}: {
  review: SoilAnalysisReview
  file: File
  soilParameterDescription: SoilParameterDescription
  onChooseOtherFile: () => void
}) {
  // A local URL for the chosen file, so the PDF can be shown without uploading it again
  const pdfUrl = getObjectUrl(file)

  // The sampling parameters and every parameter that was read from the PDF
  const parameters = soilParameterDescription.filter(
    (x) =>
      (SAMPLING_PARAMETERS as readonly string[]).includes(x.parameter) ||
      x.parameter in review.values,
  )
  const missingNames = review.missing.map(
    (parameter) =>
      soilParameterDescription.find((x) => x.parameter === parameter)?.name ?? parameter,
  )

  return (
    <div className="space-y-6">
      <SoilAnalysisUploadSteps current={2} />
      <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
        <section aria-labelledby="soil-review-pdf" className="space-y-2 xl:sticky xl:top-4">
          <h4 id="soil-review-pdf" className="text-sm font-semibold">
            {file.name}
          </h4>
          <iframe
            src={pdfUrl}
            title={`PDF-rapport ${file.name}`}
            className="bg-muted hidden h-[50vh] w-full rounded-lg border md:block xl:h-[75vh]"
          />
          <p className="text-muted-foreground text-sm md:hidden">
            Op een groter scherm staat de PDF naast de waarden. Hier open je hem in een apart
            tabblad.
          </p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium underline underline-offset-4"
          >
            Open de PDF in een nieuw tabblad
          </a>
        </section>
        <section aria-labelledby="soil-review-values" className="space-y-6">
          <div className="space-y-1">
            <h4 id="soil-review-values" className="text-base font-semibold">
              Controleer de uitgelezen waarden
            </h4>
            <p className="text-muted-foreground text-sm">
              Deze waarden zijn uit de PDF gehaald. Vergelijk ze met het rapport en vul aan wat
              ontbreekt. Ongebruikelijke waarden zijn gemarkeerd, maar houden het opslaan niet
              tegen. De analyse wordt pas vastgelegd als je op Opslaan klikt.
            </p>
          </div>
          {missingNames.length > 0 && (
            <Alert>
              <TriangleAlert aria-hidden />
              <AlertTitle>Niet gevonden in de PDF</AlertTitle>
              <AlertDescription>
                Vul deze waarden zelf in: {missingNames.join(", ").toLowerCase()}.
              </AlertDescription>
            </Alert>
          )}
          <SoilAnalysisForm
            soilAnalysis={undefined}
            initialValues={review.values}
            soilParameterDescription={parameters}
            action="."
            encType="multipart/form-data"
            submitData={{ intent: "save", soilAnalysisFile: file, review }}
            fromReport
            secondaryAction={
              <Button type="button" variant="ghost" onClick={onChooseOtherFile}>
                Ander bestand kiezen
              </Button>
            }
          />
        </section>
      </div>
    </div>
  )
}

/**
 * Explains that PDF reports cannot be read in this environment and links to manual entry.
 */
export function PdfReadingUnavailableAlert({ manualEntryHref }: { manualEntryHref: string }) {
  return (
    <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-800">
      <AlertCircle className="h-4 w-4 text-amber-800!" />
      <AlertTitle>Automatisch uitlezen van PDF's niet beschikbaar</AlertTitle>
      <AlertDescription>
        Het automatisch uitlezen van PDF-rapporten is in deze omgeving niet ingesteld. Je kunt de
        analyse{" "}
        <NavLink to={manualEntryHref} className="font-semibold underline">
          handmatig invoeren
        </NavLink>
        .
      </AlertDescription>
    </Alert>
  )
}
