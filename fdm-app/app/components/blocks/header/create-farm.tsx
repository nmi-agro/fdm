import { useLocation, useSearchParams } from "react-router"
import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

export function HeaderFarmCreate({
    b_name_farm,
}: {
    b_name_farm: string | undefined | null
}) {
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const currentPath = String(location.pathname)

    return (
        <>
            <BreadcrumbItem className="hidden xl:block">
                <BreadcrumbLink href={"/farm/create"}>
                    Maak een bedrijf
                </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden xl:block" />
            {!b_name_farm ? (
                <BreadcrumbItem>
                    <BreadcrumbLink>Algemene gegevens</BreadcrumbLink>
                </BreadcrumbItem>
            ) : (
                <>
                    <BreadcrumbItem className="hidden xl:block">
                        <BreadcrumbLink>{b_name_farm}</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden xl:block" />
                </>
            )}
            {currentPath.match(/atlas/) ? (
                <BreadcrumbItem>
                    <BreadcrumbLink>Selecteer percelen</BreadcrumbLink>
                </BreadcrumbItem>
            ) : null}
            {currentPath.match(/upload/) ? (
                <BreadcrumbItem>
                    <BreadcrumbLink>Shapefile uploaden</BreadcrumbLink>
                </BreadcrumbItem>
            ) : null}
            {currentPath.match(/fields/) ? (
                <BreadcrumbItem>
                    <BreadcrumbLink>Percelen</BreadcrumbLink>
                </BreadcrumbItem>
            ) : null}
            {currentPath.match(/cultivations/) ? (
                <>
                    <BreadcrumbItem className="hidden xl:block">
                        <BreadcrumbLink>Bouwplan</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden xl:block" />
                    <BreadcrumbItem>
                        <BreadcrumbLink>Gewassen</BreadcrumbLink>
                    </BreadcrumbItem>
                </>
            ) : null}
            {currentPath.match(/fertilizers/) ? (
                <>
                    <BreadcrumbItem className="hidden xl:block">
                        <BreadcrumbLink>Bouwplan</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden xl:block" />
                    {currentPath.match(/new/) ? (
                        <>
                            <BreadcrumbItem className="hidden xl:block">
                                <BreadcrumbLink
                                    href={searchParams.get("returnUrl") ?? "#"}
                                >
                                    Bemesting
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden xl:block" />
                            <BreadcrumbItem>
                                <BreadcrumbLink>Meststoffen</BreadcrumbLink>
                            </BreadcrumbItem>
                        </>
                    ) : (
                        <BreadcrumbItem>
                            <BreadcrumbLink>Bemesting</BreadcrumbLink>
                        </BreadcrumbItem>
                    )}
                </>
            ) : null}
            {currentPath.match(/access/) ? (
                <BreadcrumbItem>
                    <BreadcrumbLink>Toegang</BreadcrumbLink>
                </BreadcrumbItem>
            ) : null}
        </>
    )
}
