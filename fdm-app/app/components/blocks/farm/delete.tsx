import { Form } from "react-router"
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

interface FarmDeleteDialogProps {
    farmName: string
    isSubmitting: boolean
}

export function FarmDeleteDialog({
    farmName,
    isSubmitting,
}: FarmDeleteDialogProps) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isSubmitting}>
                    Bedrijf verwijderen
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Deze actie kan niet ongedaan worden gemaakt. Dit
                        verwijdert het bedrijf "{farmName}" en alle bijbehorende
                        gegevens, inclusief percelen, gewassen, bemestingen,
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
                            {isSubmitting ? (
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
