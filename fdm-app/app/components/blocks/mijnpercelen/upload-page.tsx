import type { Field } from "@nmi-agro/fdm-core"
import type {
  ImportReviewAction,
  RvoImportReviewItem,
  UserChoiceMap,
} from "@nmi-agro/fdm-rvo/types"
import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import { Loader2 } from "lucide-react"
import { useEffect, useRef } from "react"
import { Form, useActionData, useLocation, useNavigation } from "react-router"
import { toast } from "sonner"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { MijnPercelenUploadForm } from "~/components/blocks/mijnpercelen/form-upload"
import { RvoImportReviewTable } from "~/components/blocks/rvo/import-review-table"
import { Button } from "~/components/ui/button"
import { useKeyedState } from "~/hooks/use-keyed-state"
import { cn } from "~/lib/utils"
import type { genericAction } from "./loader-and-action.server"

type ReviewItem = RvoImportReviewItem<Field>

// The default action for each review item in this wizard, keyed by item id.
function defaultUserChoices(items: ReviewItem[]): UserChoiceMap {
  const choices: UserChoiceMap = {}
  for (const item of items) {
    const id = getItemId(item)
    let defaultAction: ImportReviewAction

    switch (item.status) {
      case "CONFLICT":
        defaultAction = "UPDATE_FROM_REMOTE"
        break
      case "NEW_REMOTE":
        defaultAction = "ADD_REMOTE"
        break
      case "NEW_LOCAL":
        defaultAction = "KEEP_LOCAL"
        break
      case "EXPIRED_LOCAL":
        defaultAction = "CLOSE_LOCAL"
        break
      // In creation wizard, other statuses are unlikely but good to handle defaults
      default:
        defaultAction = "NO_ACTION"
        break
    }
    choices[id] = defaultAction
  }
  return choices
}

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
  const navigation = useNavigation()
  const location = useLocation()

  const actionData = useActionData<typeof genericAction>()
  const actionRvoImportReviewData = actionData?.RvoImportReviewData

  // Resets to the server's data (clearing local edits) whenever a new import batch arrives.
  const [rvoImportReviewData, setRvoImportReviewData] = useKeyedState<
    ReviewItem[] | undefined,
    ReviewItem[] | null
  >(actionRvoImportReviewData, (data) => data ?? null)
  // Defaults re-derived per import batch; the user's choices on top are kept until the next batch.
  const [userChoices, setUserChoices] = useKeyedState(actionRvoImportReviewData, (data) =>
    data ? defaultUserChoices(data) : ({} as UserChoiceMap),
  )
  // Re-armed (false) whenever a new import batch arrives; the user explicitly disarms it by
  // clicking "Opslaan en verder" below.
  const [canUnloadSafely, setCanUnloadSafely] = useKeyedState(
    actionRvoImportReviewData,
    (data) => !data,
  )

  const handleItemChange = (id: string, item: ReviewItem) => {
    // Note: there is the assumption that getItemId will keep returning the same id.
    // Therefore, make sure that `item` doesn't have a different rvoField id and localField id.
    if (getItemId(item) !== id) {
      console.warn(
        `Mismatched item id in handleItemChange: expected ${id}, got ${getItemId(item)}. Ignoring update.`,
      )
      return
    }
    setRvoImportReviewData((data) => {
      if (!data) return data
      const index = data.findIndex((originalItem) => getItemId(originalItem) === id)
      if (index === -1) {
        console.warn(`Item with id ${id} not found so nothing is modified.`)
        return data
      }
      const newData = [...data]
      newData[index] = item
      return newData
    })
  }

  const handleChoiceChange = (id: string, action: ImportReviewAction) => {
    setUserChoices((prev: UserChoiceMap) => ({ ...prev, [id]: action }))
  }

  const isSaving =
    navigation.state !== "idle" && navigation.formData?.get("intent") === "save_fields"

  // Jump to the review section the first time an import batch arrives (DOM navigation, no state).
  const hasJumpedToReviewRef = useRef(false)
  useEffect(() => {
    if (actionRvoImportReviewData && !hasJumpedToReviewRef.current) {
      hasJumpedToReviewRef.current = true
      window.location.hash = "#review"
    }
  }, [actionRvoImportReviewData])

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

  // A failed save re-arms the guard even if the user had just disarmed it to submit.
  const effectiveCanUnloadSafely = canUnloadSafely && actionData?.success !== false

  // Warn the user before refreshing or leaving when data is present
  useEffect(() => {
    if (rvoImportReviewData && rvoImportReviewData.length > 0) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // If this redirect should have been initiated by the route action, do nothing
        if (effectiveCanUnloadSafely) {
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
  }, [effectiveCanUnloadSafely, rvoImportReviewData])

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
                  <input type="hidden" name="userChoices" value={JSON.stringify(userChoices)} />
                  <input
                    type="hidden"
                    name="RvoImportReviewDataJson"
                    value={JSON.stringify(rvoImportReviewData)}
                  />

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
                  userChoices={userChoices}
                  flags={{
                    b_bufferstrip_info_available: false,
                  }}
                  onItemChange={handleItemChange}
                  onChoiceChange={handleChoiceChange}
                />
              </div>
            </div>
          </FarmContent>
        </>
      )}
    </main>
  )
}
