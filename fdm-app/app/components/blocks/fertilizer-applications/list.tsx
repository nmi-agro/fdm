import type { Fertilizer, FertilizerApplication } from "@nmi-agro/fdm-core"
import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { Circle, Diamond, Square, Trash, Triangle } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "~/components/ui/empty"
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemSeparator,
    ItemTitle,
} from "~/components/ui/item"
import { Spinner } from "~/components/ui/spinner"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export function FertilizerApplicationsList({
    fertilizerApplications,
    applicationMethodOptions,
    fertilizers,
    canModifyFertilizerApplication = {},
    handleDelete,
    handleEdit,
    isBusy,
}: {
    fertilizerApplications: FertilizerApplication[]
    applicationMethodOptions: {
        value: ApplicationMethods
        label: string
    }[]
    fertilizers: Fertilizer[]
    canModifyFertilizerApplication?: Record<string, boolean>
    handleDelete: (p_app_id: string | string[]) => void
    handleEdit: (fertilizerApplication: FertilizerApplication) => () => void
    isBusy: boolean
}) {
    return (
        <div className="space-y-4">
            {fertilizerApplications.length > 0 ? (
                <ItemGroup>
                    {fertilizerApplications.map((application) => {
                        const fertilizer = fertilizers.find(
                            (f) => f.p_id === application.p_id,
                        )
                        if (!fertilizer) {
                            return null
                        }
                        const editable =
                            canModifyFertilizerApplication[
                                application.p_app_id
                            ] ?? true

                        return (
                            <div key={application.p_app_id}>
                                <ItemSeparator />
                                <Item size="sm" variant="default">
                                    <ItemContent>
                                        <ItemTitle className="flex flex-row flex-wrap items-center gap-x-2">
                                            <span>
                                                {fertilizer.p_type ===
                                                "manure" ? (
                                                    <Square className="size-3 text-yellow-600 fill-yellow-600" />
                                                ) : fertilizer.p_type ===
                                                  "mineral" ? (
                                                    <Circle className="size-3 text-sky-600 fill-sky-600" />
                                                ) : fertilizer.p_type ===
                                                  "compost" ? (
                                                    <Triangle className="size-3 text-green-600 fill-green-600" />
                                                ) : (
                                                    <Diamond className="size-3 text-gray-600 fill-gray-600" />
                                                )}
                                            </span>
                                            <Button
                                                variant="link"
                                                className="p-0 mt-0"
                                                disabled={!editable || isBusy}
                                                onClick={handleEdit(
                                                    application,
                                                )}
                                            >
                                                {application.p_name_nl}
                                            </Button>
                                            <span className="text-muted-foreground">
                                                {format(
                                                    application.p_app_date,
                                                    "PP",
                                                    {
                                                        locale: nl,
                                                    },
                                                )}
                                            </span>
                                        </ItemTitle>
                                        <ItemDescription>
                                            <p>
                                                {
                                                    application.p_app_amount_display
                                                }{" "}
                                                {application.p_app_amount_unit}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {application.p_app_method
                                                    ? applicationMethodOptions.find(
                                                          (x) =>
                                                              x.value ===
                                                              application.p_app_method,
                                                      )?.label
                                                    : "Toedieningsmethode niet bekend"}
                                            </p>
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions
                                        className={cn(
                                            !editable ? "invisible" : "",
                                        )}
                                    >
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        disabled={isBusy}
                                                        onClick={() => {
                                                            if (
                                                                application.p_app_ids
                                                            ) {
                                                                handleDelete(
                                                                    application.p_app_ids,
                                                                )
                                                            } else {
                                                                handleDelete([
                                                                    application.p_app_id,
                                                                ])
                                                            }
                                                        }}
                                                    >
                                                        {isBusy ? (
                                                            <Spinner />
                                                        ) : (
                                                            <Trash className="size-4" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Verwijder</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </ItemActions>
                                </Item>
                            </div>
                        )
                    })}
                    <ItemSeparator />
                </ItemGroup>
            ) : (
                <Empty className="col-span-full">
                    <EmptyHeader>
                        <EmptyTitle>
                            Je hebt nog geen bemesting ingevuld...
                        </EmptyTitle>
                        <EmptyDescription>
                            Voeg een bemesting toe om gegevens zoals, meststof,
                            hoeveelheid en datum bij te houden.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
        </div>
    )
}
