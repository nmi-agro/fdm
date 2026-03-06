import { NavLink } from "react-router"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { useCalendarStore } from "~/store/calendar"

export function BufferStripWarning({ b_id }: { b_id: string }) {
    const calendar = useCalendarStore((state) => state.calendar)

    return (
        <div className="flex items-center justify-center">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>Bufferstrook: uitgesloten van balans</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-muted-foreground">
                        <p>
                            Dit perceel is gemarkeerd als bufferstrook en wordt
                            daarom niet meegenomen in de balansberekening.
                        </p>
                    </div>
                </CardContent>
                <CardFooter>
                    <NavLink to={`../../${calendar}/field/${b_id}/overview`}>
                        <Button>Naar perceelsinstelling</Button>
                    </NavLink>
                </CardFooter>
            </Card>
        </div>
    )
}
