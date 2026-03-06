import { Breadcrumb, BreadcrumbList } from "@/app/components/ui/breadcrumb"
import { Separator } from "@/app/components/ui/separator"
import { SidebarTrigger } from "@/app/components/ui/sidebar"
import { HeaderAction, type HeaderActionProps } from "./action"

export function Header({
    action = undefined,
    children,
}: {
    children: React.ReactNode
    action: HeaderActionProps | undefined
}) {
    return (
        <header className="flex min-h-16 shrink-0 items-center gap-x-1.5 gap-y-2 border-b px-2 md:px-4 py-2 xl:py-0 flex-wrap xl:flex-nowrap">
            <div className="flex items-center gap-1.5">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mr-1 md:mr-2 h-4"
                />
            </div>
            <Breadcrumb className="flex-1 min-w-0">
                <BreadcrumbList>{children}</BreadcrumbList>
            </Breadcrumb>
            {action ? (
                <div className="shrink-0">
                    <HeaderAction
                        label={action.label}
                        to={action.to}
                        disabled={action.disabled}
                    />
                </div>
            ) : null}
        </header>
    )
}
