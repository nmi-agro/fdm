import type { Dose } from "@nmi-agro/fdm-calculator"
import type { Fertilizer } from "@nmi-agro/fdm-core"
import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import type { Navigation } from "react-router"
import { Plus } from "lucide-react"
import { useEffect, useRef } from "react"
import { useFetcher, useLocation, useNavigation, useParams } from "react-router"
import { useFieldFertilizerFormStore } from "@/app/store/field-fertilizer-form"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { useKeyedState } from "~/hooks/use-keyed-state"
import { cn } from "~/lib/utils"
import { useCalendarStore } from "~/store/calendar"
import type { FieldFertilizerFormValues } from "./formschema"
import type { FertilizerApplication, FertilizerOption } from "./types.d"
import { FertilizerApplicationForm } from "./form"
import { FertilizerApplicationsList } from "./list"

export function FertilizerApplicationCard({
  fertilizerApplications,
  applicationMethodOptions,
  fertilizers,
  fertilizerOptions,
  canCreateFertilizerApplication = true,
  canModifyFertilizerApplication = {},
}: {
  fertilizerApplications: FertilizerApplication[]
  applicationMethodOptions: {
    value: ApplicationMethods
    label: string
  }[]
  fertilizers: Fertilizer[]
  fertilizerOptions: FertilizerOption[]
  dose: Dose
  className?: string
  canCreateFertilizerApplication?: boolean
  canModifyFertilizerApplication?: Record<string, boolean>
}) {
  const fetcher = useFetcher()
  const location = useLocation()
  const params = useParams()
  const navigation = useNavigation()
  const previousNavigationState = useRef(navigation.state)

  const b_id_or_b_lu_catalogue = params.b_lu_catalogue || params.b_id

  // Selected individually: these action methods are referentially stable forever, unlike the
  // store object itself (which changes identity on every state update, including from other forms).
  const loadFertilizerForm = useFieldFertilizerFormStore((s) => s.load)
  const deleteFertilizerForm = useFieldFertilizerFormStore((s) => s.delete)
  const { calendar } = useCalendarStore()
  const savedFormValues =
    params.b_id_farm && b_id_or_b_lu_catalogue
      ? loadFertilizerForm(params.b_id_farm, b_id_or_b_lu_catalogue, calendar)
      : null

  // See if the saved form was for updating an existing application.
  const applicationToEdit = savedFormValues?.p_app_id
    ? fertilizerApplications.find((app) => app.p_app_id === savedFormValues.p_app_id)
    : null

  // Defaults to opening the dialog for the saved draft (if any, and the user can still edit or
  // create it); the user's own open/close/edit choices on top are kept until the draft changes.
  const [dialogState, setDialogState] = useKeyedState<
    typeof savedFormValues,
    { open: boolean; editing: FertilizerApplication | undefined }
  >(savedFormValues, (saved) => {
    if (!saved) return { open: false, editing: undefined }
    if (saved.p_app_id) {
      // Do not open the form if there is a risk it will create a new application
      if (
        applicationToEdit &&
        (canModifyFertilizerApplication[applicationToEdit.p_app_id] ?? true)
      ) {
        return { open: true, editing: applicationToEdit }
      }
      return { open: false, editing: undefined }
    }
    return { open: canCreateFertilizerApplication, editing: undefined }
  })
  const { open: isDialogOpen, editing: editedFertilizerApplication } = dialogState

  const handleDelete = (p_app_id: string | string[]) => {
    if (fetcher.state !== "idle") return

    void fetcher.submit({ p_app_id }, { method: "DELETE" })
  }

  const handleEdit = (fertilizerApplication: FertilizerApplication) => () => {
    setDialogState({ open: true, editing: fertilizerApplication })
  }

  useEffect(() => {
    const wasNotIdle = previousNavigationState.current !== "idle"
    const isIdle = navigation.state === "idle"

    if (wasNotIdle && isIdle) {
      setDialogState({ open: false, editing: undefined })
    }

    previousNavigationState.current = navigation.state
  }, [navigation.state, setDialogState])

  // Delete a saved draft that refers to an application that no longer exists or isn't editable.
  useEffect(() => {
    if (
      savedFormValues?.p_app_id &&
      !applicationToEdit &&
      params.b_id_farm &&
      b_id_or_b_lu_catalogue
    ) {
      deleteFertilizerForm(params.b_id_farm, b_id_or_b_lu_catalogue, calendar)
    }
  }, [
    savedFormValues,
    applicationToEdit,
    params.b_id_farm,
    b_id_or_b_lu_catalogue,
    deleteFertilizerForm,
    calendar,
  ])

  function handleDialogOpenChange(state: boolean) {
    if (!state && params.b_id_farm && b_id_or_b_lu_catalogue) {
      deleteFertilizerForm(params.b_id_farm, b_id_or_b_lu_catalogue, calendar)
    }

    setDialogState((prev) =>
      state ? { ...prev, open: true } : { open: false, editing: undefined },
    )
  }

  const formFertilizerApplication: Partial<FieldFertilizerFormValues> | null =
    editedFertilizerApplication
      ? {
          p_app_id: editedFertilizerApplication.p_app_id,
          p_app_ids: editedFertilizerApplication.p_app_ids,
          p_id: editedFertilizerApplication.p_id,
          p_app_method: editedFertilizerApplication.p_app_method ?? undefined,
          p_app_amount_display: editedFertilizerApplication.p_app_amount_display ?? undefined,
          p_app_date: editedFertilizerApplication.p_app_date,
        }
      : null

  return (
    <Card>
      <CardHeader className="flex flex-col space-y-4 xl:flex-row xl:items-center xl:justify-between xl:space-y-0">
        <CardTitle>
          <p className="text-lg font-medium">Bemesting</p>
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button className={cn(!canCreateFertilizerApplication ? "invisible" : "")}>
              <Plus className="size-4" />
              Toevoegen
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-200">
            <DialogHeader>
              <DialogTitle className="mr-4 flex flex-row items-center justify-between">
                {editedFertilizerApplication ? "Bemesting wijzigen" : "Bemesting toevoegen"}
              </DialogTitle>
              <DialogDescription>
                {editedFertilizerApplication
                  ? "Wijzig een bemestingtoepassing aan het percel."
                  : "Voeg een nieuwe bemestingstoepassing toe aan het perceel."}
              </DialogDescription>
            </DialogHeader>
            <FertilizerApplicationForm
              options={fertilizerOptions}
              action={location.pathname}
              navigation={navigation as unknown as Navigation}
              b_id_farm={params.b_id_farm || ""}
              b_id_or_b_lu_catalogue={b_id_or_b_lu_catalogue || ""}
              fertilizerApplication={formFertilizerApplication}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <FertilizerApplicationsList
          fertilizerApplications={fertilizerApplications}
          applicationMethodOptions={applicationMethodOptions}
          fertilizers={fertilizers}
          handleDelete={handleDelete}
          handleEdit={handleEdit}
          canModifyFertilizerApplication={canModifyFertilizerApplication}
          isBusy={fetcher.state !== "idle"}
        />
      </CardContent>
    </Card>
  )
}
