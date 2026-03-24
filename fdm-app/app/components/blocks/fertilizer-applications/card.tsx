import type { Dose } from "@nmi-agro/fdm-calculator"
import type { Fertilizer } from "@nmi-agro/fdm-core"
import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import { Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useFetcher, useLocation, useNavigation, useParams } from "react-router"
import { useFieldFertilizerFormStore } from "@/app/store/field-fertilizer-form"
import { useCalendarStore } from "~/store/calendar"
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
import { cn } from "~/lib/utils"
import { FertilizerApplicationForm } from "./form"
import { FertilizerApplicationsList } from "./list"
import type { FertilizerApplication, FertilizerOption } from "./types.d"

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
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editedFertilizerApplication, setEditedFertilizerApplication] =
        useState<FertilizerApplication>()
    const previousNavigationState = useRef(navigation.state)

    const b_id_or_b_lu_catalogue = params.b_lu_catalogue || params.b_id

    const handleDelete = (p_app_id: string | string[]) => {
        if (fetcher.state !== "idle") return

        fetcher.submit({ p_app_id }, { method: "DELETE" })
    }

    const handleEdit = (fertilizerApplication: FertilizerApplication) => () => {
        setEditedFertilizerApplication(fertilizerApplication)
        setIsDialogOpen(true)
    }

    useEffect(() => {
        const wasNotIdle = previousNavigationState.current !== "idle"
        const isIdle = navigation.state === "idle"

        if (wasNotIdle && isIdle) {
            setIsDialogOpen(false)
            setEditedFertilizerApplication(undefined)
        }

        previousNavigationState.current = navigation.state
    }, [navigation.state])

    const fieldFertilizerFormStore = useFieldFertilizerFormStore()
    const { calendar } = useCalendarStore()
    const savedFormValues =
        params.b_id_farm && b_id_or_b_lu_catalogue
            ? fieldFertilizerFormStore.load(
                  params.b_id_farm,
                  b_id_or_b_lu_catalogue,
                  calendar,
              )
            : null

    // See if the saved form was for updating an existing application.
    // If so, verify that the user can still edit the application and update the state.
    const applicationToEdit = savedFormValues?.p_app_id
        ? fertilizerApplications.find(
              (app) => app.p_app_id === savedFormValues.p_app_id,
          )
        : null
    useEffect(() => {
        if (applicationToEdit && !editedFertilizerApplication) {
            setEditedFertilizerApplication(applicationToEdit)
        }
        if (savedFormValues?.p_app_id && !applicationToEdit) {
            fieldFertilizerFormStore.delete(
                params.b_id_farm || "",
                b_id_or_b_lu_catalogue || "",
                calendar,
            )
        }
    }, [
        applicationToEdit,
        params.b_id_farm,
        b_id_or_b_lu_catalogue,
        savedFormValues,
        editedFertilizerApplication,
        fieldFertilizerFormStore,
        calendar,
    ])

    useEffect(() => {
        if (savedFormValues && !isDialogOpen) {
            if (savedFormValues.p_app_id) {
                // Do not open the form if there is a risk it will create a new application
                if (
                    applicationToEdit &&
                    (canModifyFertilizerApplication[
                        applicationToEdit.p_app_id
                    ] ??
                        true)
                ) {
                    setIsDialogOpen(true)
                }
            } else if (canCreateFertilizerApplication) {
                setIsDialogOpen(true)
            }
        }
    }, [
        savedFormValues,
        applicationToEdit,
        isDialogOpen,
        canCreateFertilizerApplication,
        canModifyFertilizerApplication,
    ])

    function handleDialogOpenChange(state: boolean) {
        if (!state && params.b_id_farm && b_id_or_b_lu_catalogue) {
            fieldFertilizerFormStore.delete(
                params.b_id_farm,
                b_id_or_b_lu_catalogue,
                calendar,
            )
        }

        if (!state) {
            setEditedFertilizerApplication(undefined)
        }

        setIsDialogOpen(state)
    }

    return (
        <Card>
            <CardHeader className="flex flex-col space-y-4 xl:flex-row xl:items-center xl:justify-between xl:space-y-0">
                <CardTitle>
                    <p className="text-lg font-medium">Bemesting</p>
                </CardTitle>
                <Dialog
                    open={isDialogOpen}
                    onOpenChange={handleDialogOpenChange}
                >
                    <DialogTrigger asChild>
                        <Button
                            className={cn(
                                !canCreateFertilizerApplication
                                    ? "invisible"
                                    : "",
                            )}
                        >
                            <Plus className="size-4" />
                            Toevoegen
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-200">
                        <DialogHeader>
                            <DialogTitle className="flex flex-row items-center justify-between mr-4">
                                {editedFertilizerApplication
                                    ? "Bemesting wijzigen"
                                    : "Bemesting toevoegen"}
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
                            navigation={navigation}
                            b_id_farm={params.b_id_farm || ""}
                            b_id_or_b_lu_catalogue={
                                b_id_or_b_lu_catalogue || ""
                            }
                            fertilizerApplication={editedFertilizerApplication}
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
                    canModifyFertilizerApplication={
                        canModifyFertilizerApplication
                    }
                    isBusy={fetcher.state !== "idle"}
                />
            </CardContent>
        </Card>
    )
}
