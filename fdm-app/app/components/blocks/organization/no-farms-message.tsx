import { NavLink } from "react-router"
import { Button } from "~/components/ui/button"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "~/components/ui/empty"

export function NoFarmsMessage({
    action,
}: {
    action?: { label: string; to: string }
}) {
    return (
        <Empty className="border-none">
            <EmptyHeader>
                <EmptyTitle>
                    Het lijkt erop dat je organisatie geen toegang heeft tot
                    bedrijven. :(
                </EmptyTitle>
                <EmptyDescription>
                    Neem contact op met bedrijven om toegang tot hen te krijgen.
                </EmptyDescription>
            </EmptyHeader>
            {action && (
                <EmptyContent>
                    <Button asChild>
                        <NavLink to={action.to}>{action.label}</NavLink>
                    </Button>
                </EmptyContent>
            )}
        </Empty>
    )
}
