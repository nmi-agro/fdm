import { useEffect, useRef, useState } from "react"
import { Form, useNavigation } from "react-router"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"

interface FieldDeleteDialogProps {
    fieldName: string
    isSubmitting: boolean
    buttonText?: string
}

export function FieldDeleteDialog({
    fieldName,
    isSubmitting: isParentSubmitting,
    buttonText,
}: FieldDeleteDialogProps) {
    const [open, setOpen] = useState(false)
    const navigation = useNavigation()
    const isDeleting =
        navigation.state !== "idle" && navigation.formMethod === "DELETE"

    const isSubmitting = isParentSubmitting || isDeleting

    const wasDeleting = useRef(false)
    useEffect(() => {
        if (isDeleting) {
            wasDeleting.current = true
        } else if (wasDeleting.current) {
            setOpen(false)
            wasDeleting.current = false
        }
    }, [isDeleting])

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="destructive"
                    disabled={isSubmitting}
                    type="button"
                >
                    {buttonText ?? "Perceel verwijderen"}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Deze actie kan niet ongedaan worden gemaakt. Dit
                        verwijdert het perceel "{fieldName}" en alle
                        bijbehorende gegevens, inclusief gewassen, bemestingen,
                        bodemanalyses en oogsten.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSubmitting}>
                        Annuleren
                    </AlertDialogCancel>
                    <Form method="delete">
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={isSubmitting}
                            className="w-full"
                        >
                            {isDeleting ? (
                                <div className="flex items-center space-x-2">
                                    <Spinner />
                                    <span>Verwijderen</span>
                                </div>
                            ) : (
                                "Verwijderen"
                            )}
                        </Button>
                    </Form>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
