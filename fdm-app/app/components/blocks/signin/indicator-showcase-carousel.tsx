import { cn } from "cn"
import Autoplay from "embla-carousel-autoplay"
import { useState, useSyncExternalStore } from "react"
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel"

type IndicatorShowcaseSlide = {
  id: string
  title: string
  description: string
  image: string
  alt: string
}

const INDICATOR_SHOWCASE_SLIDES: IndicatorShowcaseSlide[] = [
  {
    id: "indicatorenboom",
    title: "Van bedrijfsscore tot indicator",
    description:
      "Klap de bedrijfsscore van 78 (Goed) uit tot op indicatorniveau, zoals een fosfaatbeschikbaarheid van 59 binnen de categorie Productie (OBI).",
    image: "/fdm-screenshot-indicators-1.png",
    alt: "Uitklapbare BLN-indicatorenboom met scores voor Water, Klimaat, Productie (OBI) en BedrijfsBodemWaterPlan (BBWP)",
  },
  {
    id: "knelpunten",
    title: "Weet waar u moet beginnen",
    description:
      "De knelpuntenanalyse rangschikt indicatoren en percelen op impact. Hier is grondwateraanvulling (34) het grootste knelpunt, met een link naar de vijf percelen die daar het meest aan bijdragen.",
    image: "/fdm-screenshot-indicators-2.png",
    alt: "Knelpuntenanalyse met de zwakste indicatoren en percelen met de grootste negatieve impact",
  },
  {
    id: "maatregelen",
    title: "Maatregelen op maat van uw percelen",
    description:
      "Selecteer de percelen (hier 2 van 204) waar een maatregel geldt, stel een start- en einddatum in en volg het effect terug in uw indicatoren.",
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
  // The carousel's current slide, read reactively from the embla API instead of mirrored into
  // local state by an effect.
  const current = useSyncExternalStore(
    (onChange) => {
      if (!api) return () => {}
      api.on("select", onChange)
      return () => api.off("select", onChange)
    },
    () => api?.selectedScrollSnap() ?? 0,
    () => 0,
  )
  const [autoplayPlugin] = useState(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    return prefersReducedMotion
      ? null
      : Autoplay({ delay: 4000, stopOnMouseEnter: true, stopOnInteraction: false })
  })

  return (
    <div className="relative">
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        plugins={autoplayPlugin ? [autoplayPlugin] : undefined}
        className="mx-auto max-w-4xl"
      >
        <CarouselContent>
          {INDICATOR_SHOWCASE_SLIDES.map((slide) => (
            <CarouselItem key={slide.id}>
              <figure>
                <div className="bg-background mx-auto flex min-h-[420px] max-w-3xl items-center justify-center rounded-xl border p-6">
                  <img
                    src={slide.image}
                    alt={slide.alt}
                    className="h-auto max-h-[440px] w-auto rounded-md object-contain"
                    loading="lazy"
                  />
                </div>
                <figcaption className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed">
                  <strong className="font-semibold">{slide.title}.</strong>{" "}
                  <span className="text-muted-foreground">{slide.description}</span>
                </figcaption>
              </figure>
            </CarouselItem>
          ))}
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
