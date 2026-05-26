import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

export function HeaderUser({
    name,
    page,
}: {
    name: string
    page?: { label: string; href: string }
}) {
    return (
        <>
            <BreadcrumbItem className="hidden xl:block">
                <BreadcrumbLink href="/user/settings/profile">
                    Account
                </BreadcrumbLink>
            </BreadcrumbItem>
            {page ? (
                <>
                    <BreadcrumbSeparator className="hidden xl:block" />
                    <BreadcrumbItem>
                        <BreadcrumbLink href={page.href}>{page.label}</BreadcrumbLink>
                    </BreadcrumbItem>
                </>
            ) : (
                <>
                    <BreadcrumbSeparator className="hidden xl:block" />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/user/settings/profile">
                            {name}
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                </>
            )}
        </>
    )
}
