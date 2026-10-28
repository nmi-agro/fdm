import { FlaskConical } from "lucide-react"
import { NavLink } from "react-router"

/**
 * Quiet note under the page title: the Mineralisatie pages are experimental in design and model,
 * only open to test users, and feedback is welcome through the helpdesk.
 */
export function MineralizationExperimentalNote({ b_id_farm }: { b_id_farm: string }) {
  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
      <FlaskConical className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        Experimenteel: ontwerp en rekenmodel zijn nog in ontwikkeling en alleen beschikbaar voor
        testgebruikers. Feedback is welkom in de feedbackronden en/of via{" "}
        <NavLink
          to={`/support/new?context_farm_id=${encodeURIComponent(b_id_farm)}`}
          className="text-foreground underline underline-offset-4"
        >
          Ondersteuning
        </NavLink>
        .
      </span>
    </p>
  )
}
