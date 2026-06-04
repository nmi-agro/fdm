import type { Feature, Polygon } from "geojson"
import { CircleQuestionMark } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip"

interface FieldDetailsDialogProps {
    open: boolean
    setOpen: (value: boolean) => void
    field: Feature<Polygon>
    hint: string
}

export default function FieldDetailsInfoPopup({
    open,
    setOpen,
    field,
    hint,
}: FieldDetailsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex flex-row items-center">
                        {field.properties?.b_name ?? "Onbekend Perceel"}{" "}
                        {hint && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <CircleQuestionMark className="text-muted-foreground inline-block h-4" />
                                </TooltipTrigger>
                                <TooltipContent>{hint}</TooltipContent>
                            </Tooltip>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {field.properties?.b_area ?? "-"}
                        {" ha"}
                    </DialogDescription>
                    <DialogDescription>
                        {field.properties?.b_lu_name ?? "Onbekend gewas"}
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}
