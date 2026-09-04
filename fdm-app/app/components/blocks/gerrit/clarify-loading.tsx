import { GerritLoading } from "./loading"

interface StreamEvent {
  type: string
  data: any
}

interface ClarifyLoadingProps {
  events?: StreamEvent[]
}

export function ClarifyLoading({ events = [] }: ClarifyLoadingProps) {
  return (
    <GerritLoading
      events={events}
      title="Gerrit bekijkt het bedrijf…"
      initialMessage="Gerrit analyseert als AI-assistent de gewassen, gebruiksruimte en beschikbare meststoffen om te bepalen of er gerichte vragen nodig zijn."
    />
  )
}
