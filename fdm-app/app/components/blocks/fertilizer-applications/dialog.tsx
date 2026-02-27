import type { ApplicationExtended } from "~/components/blocks/fertilizer-applications/columns"
import { DataTable } from "~/components/blocks/fertilizer-applications/table"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "~/components/ui/empty"
import { ScrollArea } from "~/components/ui/scroll-area"

interface FertilizerInfo {
    p_id: string
    p_name_nl: string | null
}

interface FertilizerApplicationListDialogProps {
    isForRotation: boolean
    numFields: number
    fertilizer: FertilizerInfo
    fertilizerApplications: ApplicationExtended[][]
    returnUrl: string
    onClose: () => void
}

export function FertilizerApplicationListDialog({
    isForRotation,
    numFields,
    fertilizer,
    fertilizerApplications,
    returnUrl,
    onClose,
}: FertilizerApplicationListDialogProps) {
    const numFertilizerApplications = fertilizerApplications
        .map((apps) => apps.length)
        .reduce((a, b) => a + b, 0)

    const fieldNameToShow =
        numFields === 1
            ? fertilizerApplications.find((apps) => apps.length > 0)?.[0].b_name
            : undefined

    const titleSuffix = fieldNameToShow
        ? ` op ${fieldNameToShow}`
        : numFields > 1
          ? ` op ${numFields} percelen`
          : undefined

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl transition-transform duration-1000">
                <DialogHeader>
                    <DialogTitle>
                        {fertilizer.p_name_nl}
                        {titleSuffix}
                    </DialogTitle>
                    <DialogDescription>
                        Bekijk en beheer de bemestingen met deze meststof.
                    </DialogDescription>
                </DialogHeader>
                {numFertilizerApplications > 0 ? (
                    <ScrollArea className="max-h-[60vh]">
                        <DataTable
                            numFields={numFields}
                            fertilizerApplications={fertilizerApplications}
                            returnUrl={returnUrl}
                        />
                    </ScrollArea>
                ) : (
                    <Empty>
                        <EmptyHeader>
                            <EmptyTitle>Geen bemestingen gevonden</EmptyTitle>
                            <EmptyDescription>
                                {isForRotation
                                    ? "Deze meststof wordt niet langer op dit perceel/deze percelen en gewassen toegepast."
                                    : "Deze meststof wordt niet langer op dit perceel toegepast."}
                            </EmptyDescription>
                            <EmptyDescription>
                                Sluit dit venster om een nieuwe bemesting toe te
                                voegen.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" type="button">
                            Sluiten
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
