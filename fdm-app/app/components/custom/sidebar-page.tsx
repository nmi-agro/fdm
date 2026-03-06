import { NavLink, useLocation } from "react-router"
import { buttonVariants } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export interface SidebarPageProps extends React.HTMLAttributes<HTMLElement> {
    items: {
        to: string
        title: string
    }[]
}

export function SidebarPage({
    className,
    items,
    children,
    ...props
}: SidebarPageProps) {
    const { pathname, search } = useLocation()
    const domainUrl = `${pathname}${search}`

    return (
        <nav
            className={cn(
                "flex space-x-2 overflow-x-auto pb-2 lg:overflow-visible lg:pb-0 lg:flex-col lg:space-x-0 lg:space-y-1",
                className,
            )}
            {...props}
        >
            {items.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    aria-current={
                        domainUrl.startsWith(item.to) ? "page" : undefined
                    }
                    aria-label={item.title}
                    className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        domainUrl.startsWith(item.to)
                            ? "bg-muted hover:bg-muted "
                            : "hover:bg-transparent hover:underline",
                        "justify-start",
                    )}
                >
                    {item.title}
                </NavLink>
            ))}

            {children}
        </nav>
    )
}
