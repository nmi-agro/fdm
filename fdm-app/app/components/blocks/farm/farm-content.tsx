import type { ReactNode } from "react"
import { Outlet } from "react-router"
import {
    SidebarPage,
    type SidebarPageProps,
} from "~/components/custom/sidebar-page"

interface FarmContentProps {
    sidebarItems?: SidebarPageProps["items"]
    children?: ReactNode
}

export function FarmContent({ sidebarItems, children }: FarmContentProps) {
    return (
        <div className="space-y-6 px-2 md:px-4 lg:px-6 pb-0">
            <div className="flex flex-col space-y-6 lg:flex-row lg:space-x-4 xl:space-x-8 lg:space-y-0">
                {sidebarItems && (
                    <aside className="lg:w-40 xl:w-48 shrink-0">
                        <SidebarPage items={sidebarItems} />
                    </aside>
                )}

                <div className="flex-1 min-w-0">{children || <Outlet />}</div>
            </div>
        </div>
    )
}
