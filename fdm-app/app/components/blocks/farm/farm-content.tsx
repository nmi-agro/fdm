import type { ReactNode } from "react"
import { Outlet } from "react-router"
import { SidebarPage, type SidebarPageProps } from "~/components/custom/sidebar-page"

interface FarmContentProps {
  sidebarItems?: SidebarPageProps["items"]
  children?: ReactNode
}

export function FarmContent({ sidebarItems, children }: FarmContentProps) {
  return (
    <div className="space-y-6 px-2 pb-0 md:px-4 lg:px-6">
      <div className="flex flex-col space-y-6 lg:flex-row lg:space-y-0 lg:space-x-4 xl:space-x-8">
        {sidebarItems && (
          <aside className="shrink-0 lg:w-40 xl:w-48">
            <SidebarPage items={sidebarItems} />
          </aside>
        )}

        <div className="min-w-0 flex-1">{children || <Outlet />}</div>
      </div>
    </div>
  )
}
