import { useSearchParams } from "react-router"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import type { NSupplyMethod } from "~/integrations/mineralization.server"

const METHOD_OPTIONS: {
    value: NSupplyMethod
    label: string
    description: string
}[] = [
    {
        value: "minip",
        label: "MINIP",
        description: "Op basis van organische stof",
    },
    {
        value: "pmn",
        label: "PMN",
        description: "Op basis van mineraliseerbaar N",
    },
    {
        value: "century",
        label: "Century",
        description: "Op basis van organisch koolstof",
    },
]

interface MethodSelectorProps {
    value?: NSupplyMethod
}

export function MethodSelector({ value }: MethodSelectorProps) {
    const [, setSearchParams] = useSearchParams()

    const currentMethod: NSupplyMethod = value ?? "minip"

    function handleChange(method: string) {
        setSearchParams(
            (prev) => {
                prev.set("method", method)
                return prev
            },
            { preventScrollReset: true },
        )
    }

    return (
        <Select value={currentMethod} onValueChange={handleChange}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kies methode" />
            </SelectTrigger>
            <SelectContent>
                {METHOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                        <div>
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-xs text-muted-foreground">
                                {opt.description}
                            </div>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
