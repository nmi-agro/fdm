import type { ReactNode } from "react"
import { NavLink } from "react-router"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"

interface FarmTitleProps {
    title: string
    description: string
    /** Optional override rendered instead of the plain description text. */
    descriptionNode?: ReactNode
    /** Optional node rendered to the right of the title (e.g. badges, alerts). */
    rightNode?: ReactNode
    action?: {
        to: string
        label: string
    }
}

export function FarmTitle({
    title,
    description,
    descriptionNode,
    rightNode,
    action,
}: FarmTitleProps) {
    return (
        <div className="space-y-6 p-4 md:px-8 md:py-8 pb-0">
            <div className="flex flex-col xl:flex-row xl:items-start gap-4">
                <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-bold tracking-tight truncate xl:whitespace-normal">
                            {title}
                        </h2>
                    </div>
                    {descriptionNode ?? (
                        <p className="text-muted-foreground wrap-break-word">
                            {description}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3 ml-auto shrink-0 mt-4 xl:mt-0">
                    {rightNode && (
                        <div className="flex-shrink-0">
                            {rightNode}
                        </div>
                    )}
                    {action && (
                        <Button asChild>
                            <NavLink to={action.to}>{action.label}</NavLink>
                        </Button>
                    )}
                </div>
            </div>
            <Separator className="my-6" />
        </div>
    )
}

export function FarmTitleSkeleton() {
    return (
        <div className="space-y-6 p-4 md:px-8 md:py-8 pb-0">
            <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                <div className="space-y-0.5 min-w-0 flex-1">
                    <Skeleton className="h-8 w-50 md:w-64" />
                    <Skeleton className="h-5 w-62.5 md:w-96" />
                </div>
                <div className="ml-auto">
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>
            <Separator className="my-6" />
        </div>
    )
}
