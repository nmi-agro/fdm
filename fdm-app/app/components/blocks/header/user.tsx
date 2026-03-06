import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

export function HeaderUser({ name }: { name: string }) {
    return (
        <>
            <BreadcrumbItem className="hidden xl:block">
                <BreadcrumbLink href="/user">Account</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden xl:block" />
            <BreadcrumbItem>
                <BreadcrumbLink href="/user">{name}</BreadcrumbLink>
            </BreadcrumbItem>
        </>
    )
}
