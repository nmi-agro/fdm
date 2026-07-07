import {
  checkPermission,
  getField,
  getSoilAnalyses,
  getSoilAnalysis,
  getSoilImages,
  removeSoilAnalysis,
  removeSoilImage,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { Plus, Trash2 } from "lucide-react"
import { useEffect } from "react"
import {
  type ActionFunctionArgs,
  data,
  Link,
  type LoaderFunctionArgs,
  useFetcher,
  useLoaderData,
  useParams,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { BCS_COLOR_CLASSES, type BcsScores } from "~/components/blocks/soil-visual/bcs-color-utils"
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
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { useAnalytics } from "~/hooks/use-analytics"
import { deleteObject } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { isBcsAnalysis } from "~/lib/bcs"
import { computeBcs } from "~/lib/bcs.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { cn } from "~/lib/utils"

function getRouteParams(params: ActionFunctionArgs["params"]) {
  const { b_id, b_id_farm, calendar } = params
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
  return { b_id, b_id_farm, calendar }
}

function getBcsPath(params: ActionFunctionArgs["params"]) {
  const { b_id, b_id_farm, calendar } = getRouteParams(params)
  return `/farm/${b_id_farm}/${calendar}/field/${b_id}/bcs`
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { b_id } = getRouteParams(params)
    const session = await getSession(request)
    const field = await getField(fdm, session.principal_id, b_id)
    if (!field) {
      throw data("Field is not found", {
        status: 404,
        statusText: "Field is not found",
      })
    }

    const soilAnalyses = await getSoilAnalyses(fdm, session.principal_id, b_id)
    const bcsAnalyses = soilAnalyses.filter((analysis) => isBcsAnalysis(analysis))
    const pathname = new URL(request.url).pathname
    const fieldWritePermission = await checkPermission(
      fdm,
      "field",
      "write",
      b_id,
      session.principal_id,
      pathname,
      false,
    )

    return {
      field,
      fieldWritePermission,
      assessments: bcsAnalyses.map((analysis) => ({
        analysis,
        computed: computeBcs(analysis as BcsScores),
      })),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FieldBcsOverviewRoute() {
  const loaderData = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  const params = useParams()
  const { capture } = useAnalytics()

  useEffect(() => {
    capture("bcs_viewed", { b_id_farm: params.b_id_farm, b_id: params.b_id })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-medium">BodemConditieScore</h3>
          <p className="text-muted-foreground text-sm">
            Visuele bodemconditiebeoordelingen voor {loaderData.field.b_name}.
          </p>
        </div>
        {loaderData.fieldWritePermission ? (
          <Button asChild size="lg">
            <Link to="./new">
              <Plus className="size-4" />
              Nieuwe meting toevoegen
            </Link>
          </Button>
        ) : null}
      </div>

      {loaderData.assessments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nog geen BodemConditieScore</CardTitle>
            <CardDescription>
              Voeg een nieuwe visuele bodembeoordeling toe om hier resultaten te zien.
            </CardDescription>
          </CardHeader>
          {loaderData.fieldWritePermission ? (
            <CardContent>
              <Button asChild size="lg">
                <Link to="./new">Eerste beoordeling toevoegen</Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-4">
          {loaderData.assessments.map(({ analysis, computed }) => {
            const isDeleting =
              fetcher.state !== "idle" && fetcher.formData?.get("a_id") === analysis.a_id
            const measuredAt = analysis.b_sampling_date ?? analysis.a_date

            return (
              <Card key={analysis.a_id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <Link to={`./${analysis.a_id}`} className="block flex-1 rounded-lg p-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-base font-semibold">
                          {measuredAt
                            ? format(new Date(measuredAt), "PPP", {
                                locale: nl,
                              })
                            : "Onbekende datum"}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          BodemConditieScore {computed.d_bcs.toFixed(0)} · Indicator{" "}
                          {(computed.i_bcs * 100).toFixed(0)}%
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          "w-fit border px-3 py-1 text-sm",
                          BCS_COLOR_CLASSES[computed.scoreColor],
                        )}
                      >
                        {computed.scoreLabel}
                      </Badge>
                    </div>
                  </Link>
                  {loaderData.fieldWritePermission ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" disabled={isDeleting}>
                          <Trash2 className="size-4" />
                          {isDeleting ? "Verwijderen..." : "Verwijderen"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>BodemConditieScore verwijderen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deze actie kan niet ongedaan worden gemaakt. Alle foto&apos;s en
                            notities worden ook verwijderd.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuleren</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              fetcher.submit(
                                {
                                  a_id: analysis.a_id,
                                },
                                {
                                  method: "DELETE",
                                },
                              )
                            }
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Verwijderen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export async function action({ request, params }: ActionFunctionArgs) {
  getRouteParams(params)

  try {
    if (request.method !== "DELETE") {
      throw data("Method not allowed", {
        status: 405,
        statusText: "Method not allowed",
      })
    }

    const formData = await request.formData()
    const a_id_val = formData.get("a_id")
    const a_id = typeof a_id_val === "string" ? a_id_val : null
    if (!a_id) {
      throw data("Analysis ID is required", {
        status: 400,
        statusText: "Analysis ID is required",
      })
    }

    const session = await getSession(request)
    const analysis = await getSoilAnalysis(fdm, session.principal_id, a_id)
    if (!isBcsAnalysis(analysis)) {
      throw data("Geen BodemConditieScore analyse", {
        status: 403,
        statusText: "Geen BodemConditieScore analyse",
      })
    }
    const images = await getSoilImages(fdm, session.principal_id, analysis.b_id_sampling)

    await Promise.all(
      images.map((image) =>
        removeSoilImage(fdm, session.principal_id, image.a_id_image, deleteObject),
      ),
    )
    await removeSoilAnalysis(fdm, session.principal_id, a_id)

    return redirectWithSuccess(getBcsPath(params), {
      message: "BodemConditieScore is verwijderd!",
    })
  } catch (error) {
    throw handleActionError(error)
  }
}
