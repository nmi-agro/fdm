/* eslint-disable typescript/restrict-template-expressions -- Mapbox viewstates, coordinates, and layer IDs are formatted inside template literals safely. */
import type { FeatureCollection } from "geojson"
import type { MapGeoJSONFeature } from "maplibre-gl"
import throttle from "lodash.throttle"
import { Check, ChevronDown, ChevronUp, Info } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMap } from "react-map-gl/maplibre"
import { data, NavLink, useFetcher } from "react-router"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import { AtlasTooltip, AtlasTooltipFooter, AtlasTooltipHeader } from "./atlas-tooltip"

/**
 * Renders a tooltip or popup showing the field name or the cultivation name and the corresponding area,
 * for the farm or cultivation field that is currently hovered on with the mouse pointer.
 * It can also include contextual information if the field IDs "fieldsSaved", "fieldsAvailable" etc. are used.
 *
 * - `zoomLevelFields` is the zoom threshold after which no panel is shown
 * - `layer` is a layer ID or an array of IDs for which the panel is shown
 * - `layerExclude` can be a layerId or an array of IDs which block the panel from being shown
 * - `clickRedirectsToDetailsPage`, if set to true, causes the default panel to tell the user that clicking will navigate to a different page
 * - `touchDisplaysPopupInstead`, if set to true, causes touch taps not to call onFeatureClicked immediately, but to instead create an atlas popup
 * @returns the output of the render function, or a Card containing the information mentioned above.
 */
export function FieldTooltip({
  zoomLevelFields,
  layer,
  layerExclude,
  onFeatureClicked,
  clickRedirectsToDetailsPage = false,
  touchDisplaysPopupInstead = true,
}: {
  zoomLevelFields: number
  layer: string[] | string
  layerExclude?: string[] | string
  onFeatureClicked?: (feature: MapGeoJSONFeature) => void
  clickRedirectsToDetailsPage?: boolean
  touchDisplaysPopupInstead?: boolean
}) {
  const { current: map } = useMap()
  const [zoom, setZoom] = useState<number | null>(map ? map.getZoom() : null)

  useEffect(() => {
    if (!map) return
    const onZoom = () => setZoom(map.getZoom())
    onZoom()
    map.on("zoom", onZoom)
    return () => {
      map.off("zoom", onZoom)
    }
  }, [map])

  const layers = useMemo(() => (Array.isArray(layer) ? layer : [layer]), [layer])
  const layersExclude = useMemo(
    () => (!layerExclude ? [] : Array.isArray(layerExclude) ? layerExclude : [layerExclude]),
    [layerExclude],
  )

  if (!map || zoom === null || zoom < zoomLevelFields) {
    return null
  }

  return (
    <AtlasTooltip
      layers={layers}
      layersExclude={layersExclude}
      onFeatureClicked={onFeatureClicked}
      touchDisplaysPopupInstead={touchDisplaysPopupInstead}
      render={(props) => {
        const { feature, mode } = props
        if (!feature) return null

        const layer = feature.layer.id
        const name =
          layer === "fieldsSaved" ? feature.properties.b_name : feature.properties.b_lu_name
        return (
          <>
            <AtlasTooltipHeader>
              <CardTitle>{name}</CardTitle>
              <CardDescription>
                {layer === "fieldsSaved"
                  ? `${feature.properties.b_area} ha`
                  : clickRedirectsToDetailsPage
                    ? "Klik voor meer details over dit perceel"
                    : layer === "fieldsAvailable"
                      ? "Klik om te selecteren"
                      : "Klik om te verwijderen"}
              </CardDescription>
            </AtlasTooltipHeader>
            {mode === "popup" && clickRedirectsToDetailsPage && (
              <AtlasTooltipFooter>
                <Button
                  type="button"
                  className="grow"
                  onClick={() => {
                    if (onFeatureClicked && props.feature) {
                      onFeatureClicked(props.feature)
                    }
                  }}
                >
                  Meer details
                </Button>
              </AtlasTooltipFooter>
            )}
          </>
        )
      }}
    />
  )
}

export function FieldsPanelZoom({ zoomLevelFields }: { zoomLevelFields: number }) {
  const { current: map } = useMap()
  const [panel, setPanel] = useState<React.ReactNode | null>(null)

  useEffect(() => {
    function updatePanel() {
      if (map) {
        // Set message about zoom level
        const zoom = map.getZoom()
        if (zoom && zoom <= zoomLevelFields) {
          setPanel(
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Let op!</AlertTitle>
              <AlertDescription>Zoom in om percelen te kunnen selecteren.</AlertDescription>
            </Alert>,
          )
        } else {
          setPanel(null)
        }
      }
    }

    const throttledUpdatePanel = throttle(updatePanel, 200, {
      trailing: true,
    })

    if (map) {
      map.on("move", throttledUpdatePanel)
      map.on("zoom", throttledUpdatePanel)
      void map.once("load", throttledUpdatePanel)
      return () => {
        map.off("move", throttledUpdatePanel)
        map.off("zoom", throttledUpdatePanel)
      }
    }
  }, [map, zoomLevelFields])

  return panel
}

export function FieldsPanelSelection({
  fields,
  numFieldsSaved,
  continueTo,
}: {
  fields: FeatureCollection
  numFieldsSaved: number
  continueTo: string
}) {
  const fetcher = useFetcher()
  const { current: map } = useMap()
  const [panel, setPanel] = useState<React.ReactNode | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isSubmitting = fetcher.state !== "idle"

  const submitSelectedFields = useCallback(
    async (fields: FeatureCollection) => {
      if (fields.features.length === 0) return
      try {
        const formSelectedFields = new FormData()
        formSelectedFields.append("selected_fields", JSON.stringify(fields))

        await fetcher.submit(formSelectedFields, {
          method: "POST",
        })
      } catch (error: unknown) {
        console.error("Failed to submit fields: ", error)
        throw data({
          status: 500,
          statusText: `Failed to submit fields: ${error}`,
        })
        // TODO: adding a toast notification with error
      }
    },
    [fetcher],
  )

  useEffect(() => {
    function updatePanel() {
      if (map) {
        // Set information about fields
        const features = fields?.features || []
        if (features.length > 0) {
          // console.log(fields.features)

          const fieldCount = features.length
          let fieldCountText = `Je hebt ${fieldCount} percelen geselecteerd`
          if (fieldCount === 1) {
            fieldCountText = "Je hebt 1 perceel geselecteerd"
          }

          const cultivations = features.reduce(
            (
              acc: {
                b_lu_name: string
                b_lu_croprotation?: string
                count: number
              }[],
              feature,
            ) => {
              const cropField = feature.properties
              if (!cropField) return acc
              const existingCultivation = acc.find((c) => c.b_lu_name === cropField.b_lu_name)
              if (existingCultivation) {
                existingCultivation.count++
              } else {
                acc.push({
                  b_lu_name: cropField.b_lu_name,
                  b_lu_croprotation: cropField.b_lu_croprotation,
                  count: 1,
                })
              }
              return acc
            },
            [],
          )

          setPanel(
            <Card className="flex min-h-0 w-full flex-initial flex-col gap-4">
              <CardHeader className="pb-0">
                <CardTitle>Percelen</CardTitle>
                <CardDescription>{fieldCountText}</CardDescription>
              </CardHeader>
              <CardContent
                ref={scrollContainerRef}
                className="group relative flex min-h-0 flex-initial items-stretch overflow-hidden p-0"
              >
                {/* Top scroll indicator */}
                <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 flex flex-col items-center opacity-0 transition-opacity duration-200 group-data-[scroll-start]:opacity-100">
                  <Separator />
                  <ChevronUp className="text-muted-foreground my-1 h-4 w-4" />
                </div>

                <div ref={scrollRef} className="overflow-y-auto">
                  <div className="space-y-4 px-6 py-4">
                    {cultivations.map((cultivation, _index) => (
                      // let cultivationCountText = `${cultivation.count + 1} percelen`

                      <div
                        key={cultivation.b_lu_name}
                        className="grid grid-cols-[25px_1fr] items-start"
                      >
                        <span
                          className="flex h-2 w-2 translate-y-1 rounded-full"
                          style={{
                            backgroundColor: getCultivationColor(cultivation.b_lu_croprotation),
                          }}
                        />
                        <div className="space-y-1">
                          <p className="text-sm leading-none font-medium">
                            {cultivation.b_lu_name}
                          </p>
                          <p className="text-muted-foreground text-sm">{`${cultivation.count} percelen`}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom scroll indicator */}
                <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 flex flex-col items-center opacity-0 transition-opacity duration-200 group-data-[scroll-end]:opacity-100">
                  <ChevronDown className="text-muted-foreground my-1 h-4 w-4" />
                  <Separator />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => submitSelectedFields(fields)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-2">
                      <Spinner />
                      <span>Opslaan van geselecteerde percelen...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Check />
                      <span>Sla geselecteerde percelen op</span>
                    </div>
                  )}
                </Button>
              </CardFooter>
            </Card>,
          )
        } else {
          setPanel(
            <Card>
              <CardHeader>
                <CardTitle>Percelen</CardTitle>
                <CardDescription>
                  {numFieldsSaved > 0
                    ? "Je hebt geen nieuwe percelen geselecteerd"
                    : "Je hebt geen percelen geselecteerd"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4" />
              <CardFooter>
                {numFieldsSaved > 0 ? (
                  <Button asChild className="w-full">
                    <NavLink to={continueTo} className="flex items-center gap-2">
                      <Check />
                      <span>Doorgaan</span>
                    </NavLink>
                  </Button>
                ) : (
                  <Button className="w-full" disabled>
                    <Check /> Sla geselecteerde percelen op
                  </Button>
                )}
              </CardFooter>
            </Card>,
          )
        }
      }
    }
    updatePanel()
  }, [fields, isSubmitting, map, submitSelectedFields, continueTo, numFieldsSaved])

  useEffect(() => {
    const scrollElement = scrollRef.current
    const scrollContainerElement = scrollContainerRef.current
    if (!scrollElement || !scrollContainerElement) return

    function handleScroll(scrollElement: HTMLDivElement, scrollContainerElement: HTMLDivElement) {
      if (scrollElement.scrollTop > 5) {
        scrollContainerElement.dataset.scrollStart = ""
      } else {
        delete scrollContainerElement.dataset.scrollStart
      }

      if (scrollElement.scrollHeight - scrollElement.scrollTop > 5 + scrollElement.offsetHeight) {
        scrollContainerElement.dataset.scrollEnd = ""
      } else {
        delete scrollContainerElement.dataset.scrollEnd
      }
    }

    const handler = () => {
      handleScroll(scrollElement, scrollContainerElement)
    }

    const timeout = setTimeout(handler, 100)
    scrollElement.addEventListener("scroll", handler, { passive: true })
    return () => {
      scrollElement.removeEventListener("scroll", handler)
      clearTimeout(timeout)
    }
  }, [panel])

  return panel
}
