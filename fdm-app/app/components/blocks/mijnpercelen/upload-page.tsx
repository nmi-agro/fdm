import type {
    ImportReviewAction,
    RvoImportReviewItem,
    UserChoiceMap,
} from "@nmi-agro/fdm-rvo/types"
import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Form, useActionData, useLocation, useNavigation } from "react-router"
import { toast } from "sonner"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { MijnPercelenUploadForm } from "~/components/blocks/mijnpercelen/form-upload"
import { RvoImportReviewTable } from "~/components/blocks/rvo/import-review-table"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import type { genericAction } from "./loader-and-action.server"

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

    const [rvoImportReviewData, setRvoImportReviewData] = useState<
        RvoImportReviewItem<any>[] | null
    >()
    const [userChoices, setUserChoices] = useState<UserChoiceMap>({})
    const [canUnloadSafely, setCanUnloadSafely] = useState(true)

    const actionData = useActionData<typeof genericAction>()

    const handleItemChange = (id: string, item: RvoImportReviewItem<any>) => {
        // Note: there is the assumption that getItemId will keep returning the same id.
        // Therefore, make sure that `item` doesn't have a different rvoField id and localField id.
        setRvoImportReviewData((data) => {
            if (!data) return data
            const index = data.findIndex(
                (originalItem) => getItemId(originalItem) === id,
            )
            if (index === -1) {
                console.warn(
                    `Item with id ${id} not found so nothing is modified.`,
                )
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

    const actionRvoImportReviewData = actionData?.RvoImportReviewData

    const isSaving =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "save_fields"

    useEffect(() => {
        if (actionRvoImportReviewData) {
            setRvoImportReviewData((oldData) => {
                if (!oldData) {
                    window.location.hash = "#review"
                }
                return actionRvoImportReviewData
            })

            // Initialize user choices with defaults
            const initialChoices: UserChoiceMap = {}
            actionRvoImportReviewData.forEach((item) => {
                const id = getItemId(item)
                let defaultAction: ImportReviewAction

                switch (item.status) {
                    case "NEW_REMOTE":
                        defaultAction = "ADD_REMOTE"
                        break
                    // In creation wizard, other statuses are unlikely but good to handle defaults
                    default:
                        defaultAction = "NO_ACTION"
                        break
                }
                initialChoices[id] = defaultAction
            })
            setCanUnloadSafely(false)
            setUserChoices(initialChoices)
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
        window.addEventListener(
            "hashchange",
            onHashChange as unknown as (_: Event) => void,
        )
        return () =>
            window.removeEventListener(
                "hashchange",
                onHashChange as unknown as (_: Event) => void,
            )
    })

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
            return () =>
                window.removeEventListener("beforeunload", handleBeforeUnload)
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
                                    <input
                                        type="hidden"
                                        name="intent"
                                        value="save_fields"
                                    />
                                    <input
                                        type="hidden"
                                        name="userChoices"
                                        value={JSON.stringify(userChoices)}
                                    />
                                    <input
                                        type="hidden"
                                        name="RvoImportReviewDataJson"
                                        value={JSON.stringify(
                                            rvoImportReviewData,
                                        )}
                                    />

                                    <Button
                                        asChild
                                        variant="outline"
                                        className={cn(isSaving && "opacity-50")}
                                    >
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
