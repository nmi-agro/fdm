"use client"

import throttle from "lodash.throttle"
import { Loader, MapPin, X } from "lucide-react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { ControlPosition, useMap } from "react-map-gl/maplibre"
import { clientConfig } from "@/app/lib/config"
import { Button } from "~/components/ui/button"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "~/components/ui/command"
import { Popover, PopoverAnchor, PopoverContent } from "~/components/ui/popover"
import { useIsMobile } from "~/hooks/use-mobile"
import { cn } from "~/lib/utils"
import { AtlasControls } from "./atlas-controls"

type NominatimResult = {
  place_id: number
  boundingbox?: [string, string, string, string]
  lat: string
  lon: string
  name: string
  type: string
  importance: number
}

type MaptilerResult = {
  id: string
  text: string
  place_name?: string
  place_type: string[]
  relevance: number
  center: [number, number]
  bbox?: [number, number, number, number]
}

const DEBOUNCE_MS = 300
/**
 * Search bar atlas control that lets the user search for places and focus the map to those.
 */
export function GeocoderControl({ position = "top-right" }: { position?: ControlPosition }) {
  const isMobile = useIsMobile()

  const { current: map } = useMap()
  const [displayValue, setDisplayValue] = useState("")
  const [results, setResults] = useState<MaptilerResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(isMobile)

  const [debouncedQuery, setDebouncedQuery] = useState("")

  const inputRef = useRef<HTMLInputElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const throttledSetDebouncedQuery = useMemo(
    () => throttle((value: string) => setDebouncedQuery(value), DEBOUNCE_MS, { trailing: true }),
    [],
  )

  useEffect(() => () => throttledSetDebouncedQuery.cancel(), [throttledSetDebouncedQuery])

  const { provider, maptilerKey } = clientConfig.integrations.map

  // Search for locations
  useEffect(() => {
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    async function forwardGeocode(config: {
      query: string | string[]
      country?: string
      limit?: number
      signal: AbortController["signal"]
    }): Promise<MaptilerResult[]> {
      try {
        const query =
          typeof config.query === "string"
            ? config.query
            : Array.isArray(config.query)
              ? config.query.join(",")
              : ""
        if (provider === "maptiler" && maptilerKey) {
          const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
            query,
          )}.json?key=${maptilerKey}&limit=${config.limit || 5}${config.country ? `&country=${config.country}` : ""}`
          const res = await fetch(url, { signal: config.signal })
          const data = await res.json()
          if (Array.isArray(data.features)) {
            return data.features
          }
          console.warn("Maptiler response does not contain features array:", data)
          return []
        }
        if (provider === "osm") {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query,
          )}&format=json&addressdetails=1&limit=${config.limit || 5}&accept-language=nl${config.country ? `&country=${config.country}` : ""}`
          const res = await fetch(url, { signal: config.signal })
          const data = await res.json()

          if (Array.isArray(data)) {
            const results = data.map((item: NominatimResult) => {
              const bbox = item.boundingbox
                ? ([
                    Number.parseFloat(item.boundingbox[2]), // minLon
                    Number.parseFloat(item.boundingbox[0]), // minLat
                    Number.parseFloat(item.boundingbox[3]), // maxLon
                    Number.parseFloat(item.boundingbox[1]), // maxLat
                  ] as [number, number, number, number])
                : undefined

              return {
                id: item.place_id.toString(),
                text: item.name,
                place_type: [item.type],
                relevance: item.importance,
                center: [Number.parseFloat(item.lon), Number.parseFloat(item.lat)] as [
                  number,
                  number,
                ],
                bbox: bbox,
              }
            })
            return results
          }
          console.warn("Nominatim response is not an array:", data)
          return []
        }
      } catch (e) {
        console.error("Geocoding error:", e)
      }
      return []
    }

    if (!debouncedQuery?.trim()) {
      setResults([])
      setError(null)
      return
    }

    const performSearch = async () => {
      setIsSearching(true)
      setError(null)

      try {
        const suggestions = await forwardGeocode({
          query: debouncedQuery,
          country: "nl",
          limit: 5,
          signal: abortController.signal,
        })

        if (abortController.signal.aborted) return

        setResults(suggestions)
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }

        console.error("Search error:", err)
        setError(err instanceof Error ? err.message : "Er is iets misgegaan.")
        setResults([])
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false)
        }
      }
    }

    performSearch()

    // Cleanup: abort request on unmount or query change
    return () => {
      abortController.abort()
    }
  }, [maptilerKey, provider, debouncedQuery])

  // Handle input change
  const handleInputChange = useCallback(
    (value: string) => {
      setDisplayValue(value)
      throttledSetDebouncedQuery(value)
    },
    [throttledSetDebouncedQuery],
  )

  // Handle location selection
  const handleSelect = useCallback(
    async (suggestion: MaptilerResult) => {
      if (!map) return

      setIsSearching(true)
      setError(null)

      if (suggestion.bbox) {
        map.fitBounds(suggestion.bbox)
      } else {
        map.flyTo({
          center: suggestion.center,
          zoom: 14,
        })
      }

      setIsSearching(false)
    },
    [map],
  )

  // Clear search
  const clearSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    throttledSetDebouncedQuery.cancel()
    setDisplayValue("")
    setDebouncedQuery("")
    setResults([])
    setError(null)
    if (isMobile) {
      setCollapsed(true)
    }
  }, [isMobile, throttledSetDebouncedQuery])

  useEffect(() => {
    if (isMobile && !displayValue && !collapsed && inputRef.current !== document.activeElement) {
      setCollapsed(true)
    }
    if (!isMobile && collapsed) {
      setCollapsed(false)
    }
  }, [displayValue, isMobile, collapsed])

  const hasResults = results.length > 0
  const isOpen = hasResults || error != null || (!isSearching && displayValue.trim().length > 0)
  const showEmptyState =
    isOpen && !isSearching && displayValue.trim() !== "" && !hasResults && !error

  return (
    <AtlasControls position={position}>
      <Popover open={isOpen}>
        <Command className="maplibregl-ctrl w-auto rounded-lg" shouldFilter={false}>
          <PopoverAnchor
            className={cn(
              "transition-pe pointer-events-auto flex items-center justify-between gap-1 duration-300",
              !collapsed && "pe-3",
              isOpen && "border-b",
            )}
            onClick={(e) => {
              e.stopPropagation()
              if (collapsed) {
                setCollapsed(false)
                if (inputRef.current) {
                  inputRef.current.focus()
                }
              }
            }}
          >
            <CommandInput
              ref={inputRef}
              className={cn(
                "flex-1 transition-[width,margin-left] duration-300",
                collapsed ? "-ml-2 w-0" : "",
              )}
              placeholder="Zoek naar een locatie..."
              value={displayValue}
              onValueChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  clearSearch()
                }
              }}
              onBlur={() => {
                if (displayValue.trim() === "" && isMobile) {
                  setCollapsed(true)
                }
              }}
            />
            {displayValue && !isSearching && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground size-6 shrink-0"
                onClick={clearSearch}
                aria-label="Zoekopdracht wissen"
              >
                <X className="size-4" />
              </Button>
            )}
            {isSearching && (
              <span role="status" aria-label="Zoeken..." className="shrink-0">
                <Loader className="text-primary size-4 animate-spin" aria-hidden="true" />
              </span>
            )}
          </PopoverAnchor>

          <PopoverContent
            asChild
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <CommandList className="max-h-60 overflow-y-auto p-1.5">
              {error ? (
                <CommandEmpty className="py-6 text-center">
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <p className="text-destructive text-sm font-medium">Er is iets misgegaan.</p>
                    <p className="text-muted-foreground text-xs">{error}</p>
                  </div>
                </CommandEmpty>
              ) : showEmptyState ? (
                <CommandEmpty className="py-6 text-center">
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <p className="text-sm font-medium">Geen locaties gevonden</p>
                    <p className="text-muted-foreground text-xs">Probeer een andere zoekterm</p>
                  </div>
                </CommandEmpty>
              ) : hasResults ? (
                <CommandGroup>
                  {results.map((location) => (
                    <CommandItem
                      key={location.id}
                      value={location.id}
                      onSelect={() => handleSelect(location)}
                      className="hover:bg-accent flex cursor-pointer items-center rounded-md px-1 py-1"
                    >
                      <div className="flex items-center space-x-1">
                        <div className="bg-primary/10 shrink-0 rounded-full p-1">
                          <MapPin className="text-primary h-3 w-3" />
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {location.place_name ?? location.text}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>
    </AtlasControls>
  )
}
