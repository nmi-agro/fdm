import type { JSX } from "react"
import { NavLink } from "react-router"
import { cn } from "@/app/lib/utils"
import { Button } from "../../ui/button"

export interface HeaderActionProps {
    label: string
    to: string
    disabled: boolean
}

export function HeaderAction({
    label,
    to,
    disabled,
}: HeaderActionProps): JSX.Element {
    return (
        <div className="ml-auto">
            <NavLink
                to={to}
                className={cn({
                    "pointer-events-none": disabled,
                })}
            >
                <Button disabled={disabled} size="sm">
                    {label}
                </Button>
            </NavLink>
        </div>
    )
}
