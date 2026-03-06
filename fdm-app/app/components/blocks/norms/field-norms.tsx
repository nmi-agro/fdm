import type {
    NormFilling as GebruiksnormFillingResult,
    GebruiksnormResult,
} from "@nmi-agro/fdm-calculator"
import { NavLink } from "react-router-dom"
import { FieldFilterToggle } from "~/components/custom/field-filter-toggle"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"

export interface FieldNorm {
    b_id: string
    b_area: number
    norms?: {
        manure: GebruiksnormResult
        phosphate: GebruiksnormResult
        nitrogen: GebruiksnormResult
    }
    normsFilling?: {
        manure: GebruiksnormFillingResult
        phosphate: GebruiksnormFillingResult
        nitrogen: GebruiksnormFillingResult
    }
    errorMessage?: string
}

interface FieldNormsProps {
    fieldNorms: FieldNorm[]
    fieldOptions: {
        b_id: string
        b_name: string
    }[]
}

const getProgressColorClass = (percentage: number) => {
    if (percentage > 100) return "bg-orange-500"
    return "bg-green-500"
}

interface ProgressBarProps {
    value: number
}

const ProgressBar = ({ value }: ProgressBarProps) => (
    <div className="h-2 w-full rounded-full bg-muted">
        <div
            className={`h-full rounded-full ${getProgressColorClass(value)}`}
            style={{ width: `${Math.min(value, 100)}%` }}
        />
    </div>
)

interface NormItemProps {
    fieldId: string
    normName: "nitrogen" | "phosphate" | "manure"
    title: string
    unit: string
    norm: GebruiksnormResult | undefined
    filling: GebruiksnormFillingResult | undefined
}

function NormItem({
    fieldId,
    normName,
    title,
    unit,
    norm,
    filling,
}: NormItemProps) {
    if (!norm) return null

    const normValue = norm.normValue || 0
    const normSource = norm.normSource || ""
    const fillingValue = filling?.normFilling || 0
    const percentage = normValue > 0 ? (fillingValue / normValue) * 100 : 0

    return (
        <div className="block rounded-lg py-3 transition-colors hover:bg-muted/50">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">
                        {normSource}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">
                        {normValue.toFixed(0)} kg
                    </p>
                </div>
            </div>
            {filling !== undefined && (
                <div className="space-y-1">
                    <p className="text-right text-xs text-muted-foreground">
                        {fillingValue.toFixed(0)} kg gebruikt
                    </p>
                    <ProgressBar value={percentage} />
                </div>
            )}
        </div>
    )
}

export function FieldNorms({ fieldNorms, fieldOptions }: FieldNormsProps) {
    const getFieldName = (b_id: string) => {
        return (
            fieldOptions.find((field) => field.b_id === b_id)?.b_name ||
            `Perceel ${b_id}`
        )
    }

    return (
        <div>
            <div className="mb-4 flex flex-row items-center justify-between pb-2">
                <h3 className="text-lg font-medium">Perceelsniveau</h3>
                <FieldFilterToggle />
            </div>

            {fieldNorms.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                    <p>Geen percelen gevonden die voldoen aan de criteria.</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {fieldNorms.map((field) => (
                    <NavLink key={field.b_id} to={`./${field.b_id}`}>
                        <Card className="flex flex-col transition-shadow hover:shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {getFieldName(field.b_id)}
                                </CardTitle>
                                <CardDescription>{`${field.b_area.toFixed(
                                    2,
                                )} ha`}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow space-y-4">
                                {field.errorMessage ? (
                                    <div className="flex h-full flex-col justify-center rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                                        <p className="mb-1 font-medium">
                                            Kon gebruiksnormen niet berekenen
                                        </p>
                                        <p className="text-xs">
                                            {field.errorMessage}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <NormItem
                                            fieldId={field.b_id}
                                            normName="nitrogen"
                                            title="Stikstof, werkzaam"
                                            unit="kg N/ha"
                                            norm={field.norms?.nitrogen}
                                            filling={
                                                field.normsFilling?.nitrogen
                                            }
                                        />
                                        <NormItem
                                            fieldId={field.b_id}
                                            normName="phosphate"
                                            title="Fosfaat"
                                            unit="kg P₂O₅/ha"
                                            norm={field.norms?.phosphate}
                                            filling={
                                                field.normsFilling?.phosphate
                                            }
                                        />
                                        <NormItem
                                            fieldId={field.b_id}
                                            normName="manure"
                                            title="Stikstof uit dierlijke mest"
                                            unit="kg N/ha"
                                            norm={field.norms?.manure}
                                            filling={field.normsFilling?.manure}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </NavLink>
                ))}
            </div>
        </div>
    )
}
