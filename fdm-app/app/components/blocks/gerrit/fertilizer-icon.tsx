import { Circle, Diamond, Square, Triangle } from "lucide-react"

export function FertilizerIcon({ p_type }: { p_type: string }) {
  if (p_type === "manure")
    return <Square className="size-3 shrink-0 fill-yellow-600 text-yellow-600" />
  if (p_type === "mineral") return <Circle className="size-3 shrink-0 fill-sky-600 text-sky-600" />
  if (p_type === "compost")
    return <Triangle className="size-3 shrink-0 fill-green-600 text-green-600" />
  return <Diamond className="size-3 shrink-0 fill-gray-500 text-gray-500" />
}
