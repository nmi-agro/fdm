import { Sprout } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import type { Cultivation, CultivationDefaultValues, CultivationOption } from "./types"
import { CultivationAddFormDialog } from "./form-add"
import { CultivationList } from "./list"

interface Harvest {
  b_lu: string
  b_lu_harvest_date: Date | null
}

export function CultivationListCard({
  cultivationsCatalogueOptions,
  cultivations,
  harvests,
  editable = true,
  defaultValues,
  onSuggestionDialogClose,
}: {
  cultivationsCatalogueOptions: CultivationOption[]
  cultivations: Cultivation[]
  harvests: Harvest[]
  editable?: boolean
  defaultValues?: CultivationDefaultValues
  /** Called when the pre-filled suggestion dialog is closed (submitted or dismissed). */
  onSuggestionDialogClose?: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground text-xl font-semibold tracking-tight">
          Gewassen
        </CardTitle>
        {cultivations.length !== 0 && editable ? (
          <CultivationAddFormDialog
            options={cultivationsCatalogueOptions}
            defaultValues={defaultValues}
            onClose={onSuggestionDialogClose}
          />
        ) : null}
      </CardHeader>
      <CardContent>
        {cultivations.length !== 0 ? (
          <CultivationList cultivations={cultivations} harvests={harvests} />
        ) : (
          <Empty className="border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sprout />
              </EmptyMedia>
              <EmptyTitle>Dit perceel heeft nog geen gewas voor dit jaar</EmptyTitle>
              <EmptyDescription>
                Voeg een gewas toe voor dit perceel om gegevens zoals, zaai- en oogstdatum en
                opbrengst bij te houden.
              </EmptyDescription>
            </EmptyHeader>
            {editable && (
              <EmptyContent>
                <CultivationAddFormDialog
                  options={cultivationsCatalogueOptions}
                  defaultValues={defaultValues}
                  onClose={onSuggestionDialogClose}
                />
              </EmptyContent>
            )}
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
