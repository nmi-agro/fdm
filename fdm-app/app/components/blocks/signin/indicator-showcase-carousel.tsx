import Autoplay from "embla-carousel-autoplay"
import { AlertTriangle, Gauge, Wrench } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel"
import { cn } from "~/lib/utils"

type IndicatorShowcaseSlide = {
  id: string
  icon: typeof Gauge
  title: string
  description: string
  image: string
  alt: string
}

const INDICATOR_SHOWCASE_SLIDES: IndicatorShowcaseSlide[] = [
  {
    id: "indicatorenboom",
    icon: Gauge,
    title: "Van bedrijfsscore tot indicator",
    description:
      "Klap de bedrijfsscore van 78 (Goed) uit tot op indicatorniveau — zoals een fosfaatbeschikbaarheid van 59 binnen de categorie Productie (OBI).",
    image: "/fdm-screenshot-indicators-1.png",
    alt: "Uitklapbare BLN-indicatorenboom met scores voor Water, Klimaat, Productie (OBI) en BedrijfsBodemWaterPlan (BBWP)",
  },
  {
    id: "knelpunten",
    icon: AlertTriangle,
    title: "Weet waar u moet beginnen",
    description:
      "De knelpuntenanalyse rangschikt indicatoren en percelen op impact — hier is grondwateraanvulling (34) het grootste knelpunt, met een link naar de vijf percelen die daar het meest aan bijdragen.",
    image: "/fdm-screenshot-indicators-2.png",
    alt: "Knelpuntenanalyse met de zwakste indicatoren en percelen met de grootste negatieve impact",
  },
  {
    id: "maatregelen",
    icon: Wrench,
    title: "Maatregelen op maat van uw percelen",
    description:
      "Selecteer de percelen — hier 2 van 204 — waar een maatregel geldt, stel een start- en einddatum in en volg het effect terug in uw indicatoren.",
    image: "/fdm-screenshot-measures-1.png",
    alt: "Dialoog voor het toevoegen van een maatregel aan geselecteerde percelen",
  },
]

/**
 * Single-slide, legible showcase for the BLN indicators & maatregelen features.
 *
 * Renders one screenshot at a time at a large, readable size, instead of shrinking
 * all three into a cramped grid where the in-app UI text becomes illegible.
 */
export function IndicatorShowcaseCarousel() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [autoplayPlugin] = useState(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    return prefersReducedMotion
      ? null
      : Autoplay({ delay: 4000, stopOnMouseEnter: true, stopOnInteraction: false })
  })

  useEffect(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  return (
    <div className="relative">
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        plugins={autoplayPlugin ? [autoplayPlugin] : undefined}
        className="mx-auto max-w-4xl"
      >
        <CarouselContent>
          {INDICATOR_SHOWCASE_SLIDES.map((slide) => {
            const Icon = slide.icon
            return (
              <CarouselItem key={slide.id}>
                <div className="mx-auto max-w-2xl text-center">
                  <div className="bg-primary/10 text-primary mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{slide.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {slide.description}
                  </p>
                </div>
                <div className="bg-muted/10 mx-auto mt-8 flex min-h-[420px] max-w-3xl items-center justify-center rounded-xl border p-6">
                  <img
                    src={slide.image}
                    alt={slide.alt}
                    className="bg-background h-auto max-h-[440px] w-auto rounded-md object-contain shadow-sm"
                    loading="lazy"
                  />
                </div>
              </CarouselItem>
            )
          })}
        </CarouselContent>
        <CarouselPrevious className="left-2 sm:-left-4 lg:-left-10" />
        <CarouselNext className="right-2 sm:-right-4 lg:-right-10" />
      </Carousel>
      <div className="mt-6 flex items-center justify-center gap-2">
        {INDICATOR_SHOWCASE_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => api?.scrollTo(index)}
            aria-label={`Ga naar ${slide.title}`}
            aria-current={current === index}
            className={cn(
              "h-1.5 rounded-full transition-all",
              current === index ? "bg-primary w-6" : "bg-muted-foreground/30 w-1.5",
            )}
          />
        ))}
      </div>
    </div>
  )
}
