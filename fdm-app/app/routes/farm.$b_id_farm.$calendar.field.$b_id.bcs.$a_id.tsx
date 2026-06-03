import {
    checkPermission,
    getSoilAnalysis,
    getSoilImages,
    removeSoilAnalysis,
    removeSoilImage,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { ArrowLeft, Trash2 } from "lucide-react"
import {
    type ActionFunctionArgs,
    data,
    Link,
    type LoaderFunctionArgs,
    useFetcher,
    useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { BcsScoreCard } from "~/components/blocks/soil-visual/bcs-score-card"
import { ImageGallery } from "~/components/blocks/soil-visual/image-gallery"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { deleteObject, generateSignedReadUrl } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { deriveBcsScores } from "~/lib/bcs-derived.server"
import { computeBcs } from "~/lib/bcs.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

function getRouteParams(params: ActionFunctionArgs["params"]) {
    const { a_id, b_id, b_id_farm, calendar } = params
    if (!b_id_farm) {
        throw data("Farm ID is required", {
            status: 400,
            statusText: "Farm ID is required",
        })
    }
    if (!calendar) {
        throw data("Calendar is required", {
            status: 400,
            statusText: "Calendar is required",
        })
    }
    if (!b_id) {
        throw data("Field ID is required", {
            status: 400,
            statusText: "Field ID is required",
        })
    }
    if (!a_id) {
        throw data("Analysis ID is required", {
            status: 400,
            statusText: "Analysis ID is required",
        })
    }
    return { a_id, b_id, b_id_farm, calendar }
}

function getBcsPath(params: ActionFunctionArgs["params"]) {
    const { b_id, b_id_farm, calendar } = getRouteParams(params)
    return `/farm/${b_id_farm}/${calendar}/field/${b_id}/bcs`
}

function parseCoordinates(value: unknown) {
    if (typeof value === "string") {
        try {
            return parseCoordinates(JSON.parse(value))
        } catch {
            return { x: 50, y: 50 }
        }
    }

    if (
        typeof value === "object" &&
        value !== null &&
        "x" in value &&
        typeof value.x === "number" &&
        "y" in value &&
        typeof value.y === "number"
    ) {
        return { x: value.x, y: value.y }
    }

    return { x: 50, y: 50 }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const { a_id, b_id } = getRouteParams(params)
        const session = await getSession(request)
        const analysis = await getSoilAnalysis(fdm, session.principal_id, a_id)
        const images = await getSoilImages(
            fdm,
            session.principal_id,
            analysis.b_id_sampling,
        )
        const { labContext, labAnalysisDate } = await deriveBcsScores(
            fdm,
            session.principal_id,
            b_id,
            new Date(analysis.b_sampling_date ?? analysis.a_date ?? new Date()),
        )
        const computed = computeBcs(analysis, labContext ?? undefined)
        const fieldWritePermission = await checkPermission(
            fdm,
            "field",
            "write",
            b_id,
            session.principal_id,
            new URL(request.url).pathname,
            false,
        )

        return {
            analysis,
            labAnalysisDate,
            computed,
            fieldWritePermission,
            images: await Promise.all(
                images.map(async (image) => ({
                    id: image.a_id_image,
                    url: await generateSignedReadUrl(image.a_image_path),
                    caption: image.a_image_caption ?? undefined,
                    annotations: image.annotations.map((annotation) => ({
                            type: (annotation.a_image_annotation_type ?? "pin") as "pin" | "circle" | "arrow" | "freehand",
                        coordinates: parseCoordinates(
                            annotation.a_image_annotation_coordinates,
                        ),
                        text: annotation.a_image_annotation ?? undefined,
                        bcsIndicator:
                            annotation.a_image_annotation_bcs ?? undefined,
                    })),
                })),
            ),
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FieldBcsDetailRoute() {
    const loaderData = useLoaderData<typeof loader>()
    const fetcher = useFetcher()
    const measuredAt =
        loaderData.analysis.b_sampling_date ?? loaderData.analysis.a_date

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                    <Button asChild variant="outline">
                        <Link to="..">
                            <ArrowLeft className="size-4" />
                            Terug naar overzicht
                        </Link>
                    </Button>
                    <div>
                        <h3 className="text-lg font-medium">BCS meting</h3>
                        <p className="text-sm text-muted-foreground">
                            {measuredAt
                                ? format(new Date(measuredAt), "PPP", {
                                      locale: nl,
                                  })
                                : "Onbekende datum"}
                        </p>
                    </div>
                </div>
                {loaderData.fieldWritePermission ? (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={fetcher.state !== "idle"}
                            >
                                <Trash2 className="size-4" />
                                {fetcher.state !== "idle"
                                    ? "Verwijderen..."
                                    : "Verwijderen"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    BCS-meting verwijderen?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Deze actie kan niet ongedaan worden gemaakt.
                                    Alle foto&apos;s en notities worden ook
                                    verwijderd.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() =>
                                        fetcher.submit(null, {
                                            method: "DELETE",
                                        })
                                    }
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Verwijderen
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ) : null}
            </div>

            {loaderData.labAnalysisDate ? (
                <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                    pH en organische stof zijn afgeleid uit de labanalyse van{" "}
                    {format(new Date(loaderData.labAnalysisDate), "PPP", {
                        locale: nl,
                    })}
                    .
                </div>
            ) : null}

            {/* Desktop 2-column: score card left, images right */}
            <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
                <BcsScoreCard
                    scores={loaderData.analysis}
                    a_ph_bcs={loaderData.computed.a_ph_bcs}
                    a_som_bcs={loaderData.computed.a_som_bcs}
                    d_bcs={loaderData.computed.d_bcs}
                    i_bcs={loaderData.computed.i_bcs}
                    scoreColor={loaderData.computed.scoreColor}
                    scoreLabel={loaderData.computed.scoreLabel}
                />

                {loaderData.images.length > 0 ? (
                    <div className="space-y-3">
                        <h4 className="font-medium">Foto&apos;s en notities</h4>
                        <ImageGallery images={loaderData.images} />
                    </div>
                ) : null}
            </div>
        </div>
    )
}

export async function action({ request, params }: ActionFunctionArgs) {
    const { a_id } = getRouteParams(params)

    try {
        if (request.method !== "DELETE") {
            throw data("Method not allowed", {
                status: 405,
                statusText: "Method not allowed",
            })
        }

        const session = await getSession(request)
        const analysis = await getSoilAnalysis(fdm, session.principal_id, a_id)
        const images = await getSoilImages(
            fdm,
            session.principal_id,
            analysis.b_id_sampling,
        )

        await Promise.all(
            images.map((image) =>
                removeSoilImage(
                    fdm,
                    session.principal_id,
                    image.a_id_image,
                    deleteObject,
                ),
            ),
        )
        await removeSoilAnalysis(fdm, session.principal_id, a_id)

        return redirectWithSuccess(getBcsPath(params), {
            message: "BCS-meting is verwijderd! 🎉",
        })
    } catch (error) {
        throw handleActionError(error)
    }
}
