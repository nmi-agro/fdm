import type {
  NormFilling as GebruiksnormFillingResult,
  GebruiksnormResult,
} from "@nmi-agro/fdm-calculator"
import { NavLink } from "react-router"
import { FieldFilterToggle } from "~/components/custom/field-filter-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { NormProgressBar } from "./progress-bar"

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
  isWarning?: boolean
}

interface FieldNormsProps {
  fieldNorms: FieldNorm[]
  fieldOptions: {
    b_id: string
    b_name: string
  }[]
}

interface NormItemProps {
  title: string
  norm: GebruiksnormResult | undefined
  filling: GebruiksnormFillingResult | undefined
}

function NormItem({ title, norm, filling }: NormItemProps) {
  if (!norm) return null

  const normValue = norm.normValue || 0
  const normSource = norm.normSource || ""
  const fillingValue = filling?.normFilling || 0

  return (
    <div className="hover:bg-muted/50 block rounded-lg py-3 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{normSource}</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{normValue.toFixed(0)} kg</p>
        </div>
      </div>
      {filling !== undefined && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-right text-xs">
            {fillingValue.toFixed(0)} kg gebruikt
          </p>
          <NormProgressBar used={fillingValue} limit={normValue} />
        </div>
      )}
    </div>
  )
}

export function FieldNorms({ fieldNorms, fieldOptions }: FieldNormsProps) {
  const getFieldName = (b_id: string) => {
    return fieldOptions.find((field) => field.b_id === b_id)?.b_name || `Perceel ${b_id}`
  }

  return (
    <div>
      <div className="mb-4 flex flex-row items-center justify-between pb-2">
        <h3 className="text-lg font-medium">Perceelsniveau</h3>
        <FieldFilterToggle />
      </div>

      {fieldNorms.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">
          <p>Geen percelen gevonden die voldoen aan de criteria.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {fieldNorms.map((field) => (
          <NavLink key={field.b_id} to={`./${field.b_id}`}>
            <Card className="flex flex-col transition-shadow hover:shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">{getFieldName(field.b_id)}</CardTitle>
                <CardDescription>{`${field.b_area.toFixed(2)} ha`}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                {field.errorMessage ? (
                  field.isWarning ? (
                    <div className="flex h-full flex-col justify-center rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
                      <p className="mb-1 font-medium">Geen gebruiksnorm gevonden</p>
                      <p className="text-xs">{field.errorMessage}</p>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col justify-center rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                      <p className="mb-1 font-medium">Kon gebruiksnormen niet berekenen</p>
                      <p className="text-xs">{field.errorMessage}</p>
                    </div>
                  )
                ) : (
                  <div className="space-y-1">
                    <NormItem
                      title="Stikstof, werkzaam"
                      norm={field.norms?.nitrogen}
                      filling={field.normsFilling?.nitrogen}
                    />
                    <NormItem
                      title="Fosfaat"
                      norm={field.norms?.phosphate}
                      filling={field.normsFilling?.phosphate}
                    />
                    <NormItem
                      title="Stikstof uit dierlijke mest"
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
