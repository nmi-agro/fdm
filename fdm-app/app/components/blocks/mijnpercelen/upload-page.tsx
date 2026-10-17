import type { Field } from "@nmi-agro/fdm-core"
import type { RvoImportReviewItem } from "@nmi-agro/fdm-rvo/types"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Form, useActionData, useLoaderData, useLocation, useNavigation } from "react-router"
import { toast } from "sonner"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { MijnPercelenUploadForm } from "~/components/blocks/mijnpercelen/form-upload"
import {
  CustomValueButtonsToggle,
  RvoImportReviewTable,
  useRvoImportForm,
} from "~/components/blocks/rvo/import-review-table"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import type { genericAction, loader } from "./loader-and-action.server"

type ReviewItem = RvoImportReviewItem<Field>

const emptyReviewData: ReviewItem[] = []
const mijnPercelenReviewFlags = { b_bufferstrip_info_available: false }

/**
 * Renders a single-page wizard that handles MijnPercelen shapefile uploads.
 *
 * This component is designed to submit to `genericAction` which drives the navigation between the wizard's pages as shapefile data is loaded and becomes available.
 *
 * - `b_id_farm` is the id of the farm to upload to. It must be the same one found in the page URL
 * - `calendar` is the calendar year as understood by fdm-core
 * - `backUrl` will be added to links which let the user go back to the page where they came here from
 */
export function UploadMijnPercelenPage({
  b_id_farm,
  calendar,
  backUrl,
}: {
  b_id_farm: string
  calendar: string
  backUrl: string
}) {
  const { cultivationOptions } = useLoaderData<typeof loader>()
  type ActionData = Exclude<Awaited<ReturnType<typeof genericAction>>, Response>
  const actionData = useActionData<ActionData>()
  const navigation = useNavigation()
  const location = useLocation()

  const rvoImportReviewData = actionData?.RvoImportReviewData
  const isSaving =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "save_fields"

  const [canUnloadSafely, setCanUnloadSafely] = useState(true)
  const { formValues } = useRvoImportForm(rvoImportReviewData ?? emptyReviewData, {
    calendar,
    flags: mijnPercelenReviewFlags,
  })

  // Warn the user before refreshing or leaving when data is present
  useEffect(() => {
    if ((rvoImportReviewData ?? emptyReviewData).length > 0) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue =
          "Als u de pagina ververst, wordt de verbinding met RVO verbroken en moet u opnieuw inloggen met eHerkenning. Wilt u doorgaan?"
        return e.returnValue
      }
      window.addEventListener("beforeunload", handleBeforeUnload)
      return () => window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [rvoImportReviewData])

  useEffect(() => {
    if (typeof window === "undefined") return
    function onHashChange(event: HashChangeEvent) {
      if (new URL(event.newURL).hash === "") {
        event.preventDefault()
        window.location.href = window.location.href.toString()
      }
    }
    window.addEventListener("hashchange", onHashChange as unknown as (_: Event) => void)
    return () =>
      window.removeEventListener("hashchange", onHashChange as unknown as (_: Event) => void)
  }, [])

  // Show alerts
  useEffect(() => {
    if (actionData?.message) {
      if (actionData.success) {
        toast.success(actionData.message)
      } else {
        toast.error(actionData.message)
      }
    }
  }, [actionData])

  // Mark unload as not safe if action data changes to unsuccessful
  useEffect(() => {
    if (!actionData?.success && rvoImportReviewData?.length) {
      setCanUnloadSafely(false)
    }
  }, [actionData?.success, rvoImportReviewData])

  // Warn the user before refreshing or leaving when data is present
  useEffect(() => {
    if (rvoImportReviewData && rvoImportReviewData.length > 0) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // If this redirect should have been initiated by the route action, do nothing
        if (canUnloadSafely) {
          return
        }
        e.preventDefault()
        if (typeof window !== "undefined") {
          if (window.location.hash === "") {
            // Run out of the current call stack so the browser doesn't intercept it
            setTimeout(() => (window.location.hash = "#upload"))
          }
        }
        e.returnValue =
          "Als u de pagina ververst, wordt de verbinding met RVO verbroken en moet u opnieuw inloggen met eHerkenning. Wilt u doorgaan?"
        return e.returnValue
      }
      window.addEventListener("beforeunload", handleBeforeUnload)
      return () => window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [canUnloadSafely, rvoImportReviewData])

  return (
    <main className="flex-1 overflow-auto">
      {!rvoImportReviewData ? (
        <div className="flex h-screen items-center justify-center">
          <MijnPercelenUploadForm
            key={b_id_farm}
            b_id_farm={b_id_farm}
            calendar={calendar}
            backUrl={backUrl}
          />
        </div>
      ) : (
        <>
          <FarmTitle
            title="Verwerken van geïmporteerde percelen"
            description="Controleer de percelen die zijn geïmporteerd vanuit het shapefile. Deze worden toegevoegd aan uw nieuwe bedrijf."
          />
          <FarmContent>
            <div className="flex flex-col space-y-4 pb-10">
              <Form method="post">
                <div className="flex justify-end gap-2">
                  <input type="hidden" name="intent" value="save_fields" />
                  <input
                    type="hidden"
                    name="fieldsToAdd"
                    value={JSON.stringify(formValues.fieldsToAdd)}
                  />
                  <input
                    type="hidden"
                    name="fieldsToRemove"
                    value={JSON.stringify(formValues.fieldsToRemove)}
                  />
                  <input
                    type="hidden"
                    name="fieldsToUpdate"
                    value={JSON.stringify(formValues.fieldsToUpdate)}
                  />

                  <CustomValueButtonsToggle />

                  <Button asChild variant="outline" className={cn(isSaving && "opacity-50")}>
                    {/* Vanilla anchor triggers refresh behavior */}
                    <a
                      href={`${location.pathname}${location.search}`}
                      onClick={(e) => {
                        if (isSaving) e.preventDefault()
                      }}
                    >
                      Terug naar uploaden
                    </a>
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSaving}
                    onClick={() => setCanUnloadSafely(true)}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Opslaan...
                      </>
                    ) : (
                      "Opslaan en verder"
                    )}
                  </Button>
                </div>
              </Form>
              <div className="w-full">
                <RvoImportReviewTable
                  data={rvoImportReviewData}
                  calendar={calendar}
                  cultivationOptions={cultivationOptions}
                  flags={mijnPercelenReviewFlags}
                />
              </div>
            </div>
          </FarmContent>
        </>
      )}
    </main>
  )
}
