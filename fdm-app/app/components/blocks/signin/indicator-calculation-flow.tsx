import { motion } from "framer-motion"
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronsRight,
  Gauge,
  Info,
  LayersIcon,
  Plus,
  Scale,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card"
import { cn } from "~/lib/utils"

type FlowStepTone = "input" | "result" | "final"

/** Extra background copy shown on hover/focus for each node in the calculation flow. */
const FLOW_STEP_DETAILS = {
  invoerdata:
    "Alle data die u invoert of ophaalt voor uw bedrijf (bodemanalyses, teeltregistraties, perceelseigenschappen en locatie) vormt de basis voor elke indicator. U hoeft nooit zelf een afgeleide waarde te berekenen.",
  status: "Per indicator wordt uit uw invoerdata de actuele bodemtoestand afgeleid.",
  doel: "De streefwaarde wordt per perceel bepaald op basis van locatie, bodemtype en andere kenmerken, hierdoor kunnen twee percelen met hetzelfde gewas toch een ander doel hebben.",
  index:
    "De index (0–100) drukt uit hoe dicht de status bij het doel ligt: hoe kleiner de afwijking, hoe hoger de index.",
  maatregelen:
    "Elke maatregel wordt eerst getoetst op toepasbaarheid voor het perceel en de indicator, en heeft daarnaast een vastgestelde effectgrootte.",
  impact:
    "De impact is het gecombineerde effect van alle toepasselijke, geselecteerde maatregelen voor deze specifieke indicator.",
  score:
    "De index en de impact van uw maatregelen worden samen de indicatorscore die u terugziet op de indicatorenpagina, per perceel en op bedrijfsniveau.",
} as const

/**
 * A single node card in the indicator-calculation flow diagram. When `detail`
 * is provided, hovering (or focusing, for keyboard users) reveals a richer
 * explanation with a concrete example — the short label stays scannable, the
 * hover-card carries the depth.
 */
function FlowStep({
  icon: Icon,
  title,
  description,
  detail,
  tone = "input",
  compact = false,
  className,
}: {
  icon: typeof Gauge
  title: string
  description: string
  detail?: string
  tone?: FlowStepTone
  compact?: boolean
  className?: string
}) {
  const card = (
    <div
      tabIndex={detail ? 0 : undefined}
      className={cn(
        "rounded-xl border shadow-sm transition-all",
        compact ? "p-3.5" : "p-5",
        tone === "final"
          ? "bg-primary text-primary-foreground border-primary"
          : tone === "result"
            ? "bg-primary/5 border-primary/30"
            : "bg-card",
        detail &&
          "focus-visible:ring-ring cursor-help hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex items-center justify-center rounded-lg",
            compact ? "mb-2 h-8 w-8" : "mb-3 h-10 w-10",
            tone === "final"
              ? "bg-primary-foreground/10 text-primary-foreground"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </div>
        {detail && (
          <Info
            className={cn(
              "mt-0.5 h-3.5 w-3.5 shrink-0",
              tone === "final" ? "text-primary-foreground/50" : "text-muted-foreground/50",
            )}
            aria-hidden="true"
          />
        )}
      </div>
      <h4
        className={cn(
          "font-semibold",
          compact ? "mb-0.5 text-sm" : "mb-1",
          tone === "final" && !compact && "text-lg",
        )}
      >
        {title}
      </h4>
      <p
        className={cn(
          compact ? "text-xs leading-snug" : "text-sm leading-relaxed",
          tone === "final" ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {description}
      </p>
    </div>
  )

  if (!detail) return card

  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>{card}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-md">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{detail}</p>
      </HoverCardContent>
    </HoverCard>
  )
}

/** A small vertical connector between flow steps: a chevron with an optional label. */
function FlowConnector({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground/70 flex flex-col items-center gap-1 py-3">
      <ChevronDown className="h-4 w-4" aria-hidden="true" />
      <span className="text-xs">{label}</span>
    </div>
  )
}

/**
 * Vertical flow diagram (mobile/tablet): input data becomes a status, which is
 * measured against a target to produce an index (0–100); selected measures
 * produce an impact; index and impact together form the final indicator score.
 */
function IndicatorCalculationFlowVertical() {
  const fadeUp = {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Shared input data → fans out into Status and Doel */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-sm"
      >
        <FlowStep
          icon={LayersIcon}
          title="Invoerdata"
          description="Bodemanalyse, teeltgegevens, perceelseigenschappen en locatie: de ruwe data die u al heeft."
          detail={FLOW_STEP_DETAILS.invoerdata}
          className="w-full text-center [&>div]:mx-auto"
        />
      </motion.div>
      <FlowConnector label="berekend naar" />
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} {...fadeUp}>
          <FlowStep
            icon={Gauge}
            title="Status"
            description="De actuele toestand van de bodem voor deze indicator."
            detail={FLOW_STEP_DETAILS.status}
          />
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <FlowStep
            icon={Target}
            title="Doel"
            description="De streefwaarde voor een gezonde bodem, specifiek voor dit perceel."
            detail={FLOW_STEP_DETAILS.doel}
          />
        </motion.div>
      </div>

      <motion.div
        {...fadeUp}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center"
      >
        <FlowConnector label="status vergeleken met doel" />
        <FlowStep
          icon={Scale}
          title="Index (0–100)"
          description="Hoe dichter de status bij het doel ligt, hoe hoger de index."
          detail={FLOW_STEP_DETAILS.index}
          tone="result"
          className="w-full max-w-sm text-center [&>div]:mx-auto"
        />
      </motion.div>

      {/* Branch 2: selected measures → impact */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mt-10 flex max-w-sm flex-col items-center border-t pt-10"
      >
        <FlowStep
          icon={Wrench}
          title="Geselecteerde maatregelen"
          description="Elke maatregel telt mee naar toepasbaarheid op dit perceel en effectgrootte."
          detail={FLOW_STEP_DETAILS.maatregelen}
          className="w-full text-center [&>div]:mx-auto"
        />
        <FlowConnector label="bepaalt" />
        <FlowStep
          icon={TrendingUp}
          title="Impact"
          description="Het gecombineerde effect van uw maatregelen op deze indicator."
          detail={FLOW_STEP_DETAILS.impact}
          tone="result"
          className="w-full text-center [&>div]:mx-auto"
        />
      </motion.div>

      {/* Merge: index + impact → final score */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mt-6 flex flex-col items-center"
      >
        <div className="text-muted-foreground mb-4 flex items-center gap-3 text-sm font-medium">
          <span>Index</span>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Impact</span>
        </div>
        <FlowStep
          icon={BadgeCheck}
          title="Indicatorscore"
          description="De score die u terugziet op de indicatorenpagina, per perceel en op bedrijfsniveau."
          detail={FLOW_STEP_DETAILS.score}
          tone="final"
          className="w-full max-w-sm text-center [&>div]:mx-auto"
        />
      </motion.div>
    </div>
  )
}

/**
 * Horizontal flow diagram (desktop): the same calculation, laid out left to
 * right as a genuine flowchart. Arrows pulse in sequence on scroll-into-view
 * so the diagram reads as data flowing through the pipeline, once, on reveal.
 */
function IndicatorCalculationFlowHorizontal() {
  const node = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
  })

  const arrow = (delay: number) => ({
    initial: { opacity: 0 },
    whileInView: { opacity: 1, x: [0, 5, 0] },
    viewport: { once: true, margin: "-100px" },
    transition: {
      opacity: { duration: 0.3, delay },
      x: { duration: 0.7, delay: delay + 0.15, ease: "easeInOut" as const },
    },
  })

  return (
    <div className="hidden lg:block">
      <div className="grid grid-cols-[1fr_2.5rem_1fr_2.5rem_1fr_2.5rem_1.15fr] items-center gap-x-1 gap-y-6">
        {/* Shared input data, spanning rows 1–2, fans out into Status and Doel */}
        <motion.div {...node(0)} className="col-start-1 row-span-2 row-start-1">
          <FlowStep
            compact
            icon={LayersIcon}
            title="Invoerdata"
            description="Bodemanalyse, teelt, perceel en locatie."
            detail={FLOW_STEP_DETAILS.invoerdata}
          />
        </motion.div>
        <motion.div
          {...arrow(0.1)}
          className="col-start-2 row-span-2 row-start-1 flex justify-center"
        >
          <ChevronsRight className="text-muted-foreground/50 h-5 w-5" aria-hidden="true" />
        </motion.div>

        {/* Row 1: → Status */}
        <motion.div {...node(0.15)} className="col-start-3 row-start-1">
          <FlowStep
            compact
            icon={Gauge}
            title="Status"
            description="Actuele bodemtoestand."
            detail={FLOW_STEP_DETAILS.status}
          />
        </motion.div>

        {/* Row 2: → Doel */}
        <motion.div {...node(0.2)} className="col-start-3 row-start-2">
          <FlowStep
            compact
            icon={Target}
            title="Doel"
            description="Streefwaarde bodem."
            detail={FLOW_STEP_DETAILS.doel}
          />
        </motion.div>

        {/* Merge rows 1–2 → Index */}
        <motion.div
          {...arrow(0.3)}
          className="col-start-4 row-span-2 row-start-1 flex flex-col items-center justify-center gap-1"
        >
          <ChevronsRight className="text-primary/60 h-5 w-5" aria-hidden="true" />
        </motion.div>
        <motion.div {...node(0.35)} className="col-start-5 row-span-2 row-start-1">
          <FlowStep
            compact
            icon={Scale}
            title="Index"
            description="Score 0–100 t.o.v. doel."
            detail={FLOW_STEP_DETAILS.index}
            tone="result"
          />
        </motion.div>
        <motion.div
          {...arrow(0.45)}
          className="col-start-6 row-span-2 row-start-1 flex justify-center"
        >
          <ArrowRight className="text-muted-foreground/50 h-5 w-5" aria-hidden="true" />
        </motion.div>

        {/* Row 3: Maatregelen → Impact, bypassing Index straight into the final score */}
        <motion.div {...node(0.1)} className="col-start-1 row-start-3">
          <FlowStep
            compact
            icon={Wrench}
            title="Maatregelen"
            description="Toepasbaarheid en effect."
            detail={FLOW_STEP_DETAILS.maatregelen}
          />
        </motion.div>
        <motion.div {...arrow(0.2)} className="col-start-2 row-start-3 flex justify-center">
          <ArrowRight className="text-muted-foreground/50 h-5 w-5" aria-hidden="true" />
        </motion.div>
        <motion.div {...node(0.25)} className="col-start-3 row-start-3">
          <FlowStep
            compact
            icon={TrendingUp}
            title="Impact"
            description="Effect van maatregelen."
            detail={FLOW_STEP_DETAILS.impact}
            tone="result"
          />
        </motion.div>
        <motion.div
          {...arrow(0.35)}
          className="col-span-3 col-start-4 row-start-3 flex items-center gap-1"
        >
          <span
            aria-hidden="true"
            className="border-muted-foreground/30 h-px flex-1 border-t border-dashed"
          />
          <ArrowRight className="text-muted-foreground/50 h-5 w-5 shrink-0" aria-hidden="true" />
        </motion.div>

        {/* Final: Index + Impact → Indicatorscore */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="col-start-7 row-span-3 row-start-1 self-stretch"
        >
          <FlowStep
            icon={BadgeCheck}
            title="Indicatorscore"
            description="Zichtbaar per perceel en op bedrijfsniveau."
            detail={FLOW_STEP_DETAILS.score}
            tone="final"
            className="flex h-full flex-col justify-center"
          />
        </motion.div>
      </div>
    </div>
  )
}

/** Renders the vertical flow on mobile/tablet and the horizontal flowchart on desktop. */
export function IndicatorCalculationFlow() {
  return (
    <>
      <div className="lg:hidden">
        <IndicatorCalculationFlowVertical />
      </div>
      <IndicatorCalculationFlowHorizontal />
    </>
  )
}
