import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { clientConfig } from "~/lib/config"

export function HeaderAbout() {
    return (
        <>
            <BreadcrumbItem className="hidden xl:block">
                <BreadcrumbLink href="/about">{`Over ${clientConfig.name}`}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden xl:block" />
            <BreadcrumbItem>
                <BreadcrumbLink href="/about/whats-new">
                    Wat is er nieuw?
                </BreadcrumbLink>
            </BreadcrumbItem>
        </>
    )
}
