import { Circle, Diamond, Square, Triangle } from "lucide-react"

export function FertilizerIcon({ p_type }: { p_type: string }) {
    if (p_type === "manure")
        return (
            <Square className="size-3 text-yellow-600 fill-yellow-600 shrink-0" />
        )
    if (p_type === "mineral")
        return <Circle className="size-3 text-sky-600 fill-sky-600 shrink-0" />
    if (p_type === "compost")
        return (
            <Triangle className="size-3 text-green-600 fill-green-600 shrink-0" />
        )
    return <Diamond className="size-3 text-gray-500 fill-gray-500 shrink-0" />
}
