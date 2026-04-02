import { ChevronDown } from "lucide-react"
import { NavLink, useLocation, useMatches, useParams } from "react-router"
import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export function HeaderOrganization({
    selectedOrganizationSlug,
    organizationOptions,
}: {
    selectedOrganizationSlug: string | undefined
    organizationOptions: HeaderOrganizationOption[]
}) {
    const location = useLocation()
    const params = useParams()
    const matches = useMatches()
    const currentPath = String(location.pathname)

    const isSettingsRoute = !!matches.find(
        (match) => match.id === "routes/organization.$slug.settings",
    )
    const isMembersRoute = !!matches.find(
        (match) => match.id === "routes/organization.$slug.members",
    )
    const isFarmsRoute = !!matches.find(
        (match) => match.id === "routes/organization.$slug.$calendar.farms",
    )
    const isInvitationRespondRoute = !!matches.find(
        (match) =>
            match.id ===
            "routes/organization.invitations.$invitation_id.respond",
    )
    const isNewOrganizationRoute = !!matches.find(
        (match) => match.id === "routes/organization.new",
    )
    const typesOfBalanceRoutes = ["nitrogen", "organic-matter"] as const
    const farmBalanceRouteType = typesOfBalanceRoutes.find((type) =>
        matches.find(
            (match) =>
                match.id ===
                `routes/organization.$slug.$calendar.balance.${type}._index`,
        ),
    )

    return (
        <>
            <BreadcrumbItem className="hidden xl:block">
                <BreadcrumbLink href="/organization">
                    Organisaties
                </BreadcrumbLink>
            </BreadcrumbItem>
            {isNewOrganizationRoute ? (
                <>
                    <BreadcrumbSeparator className="hidden xl:block" />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/organization/new">
                            Nieuwe organisatie
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                </>
            ) : isInvitationRespondRoute ? (
                <>
                    <BreadcrumbSeparator className="hidden xl:block" />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/invitations">
                            Uitnodiging
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                </>
            ) : (
                <>
                    <BreadcrumbSeparator className="hidden xl:block" />
                    <BreadcrumbItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-1 max-w-[120px] sm:max-w-[200px] md:max-w-none outline-none">
                                <span className="truncate">
                                    {selectedOrganizationSlug &&
                                    organizationOptions
                                        ? (organizationOptions.find(
                                              (option) =>
                                                  option.slug ===
                                                  selectedOrganizationSlug,
                                          )?.name ?? "Unknown organization")
                                        : "Kies een organisatie"}
                                </span>
                                <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
                            </DropdownMenuTrigger>
                            {organizationOptions &&
                            organizationOptions.length > 0 ? (
                                <DropdownMenuContent align="start">
                                    {organizationOptions.map((option) => (
                                        <DropdownMenuCheckboxItem
                                            checked={
                                                selectedOrganizationSlug ===
                                                option.slug
                                            }
                                            key={option.slug}
                                        >
                                            <NavLink
                                                to={
                                                    selectedOrganizationSlug
                                                        ? currentPath.replace(
                                                              selectedOrganizationSlug,
                                                              option.slug,
                                                          )
                                                        : `/organization/${option.slug}`
                                                }
                                            >
                                                {option.name}
                                            </NavLink>
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            ) : null}
                        </DropdownMenu>
                    </BreadcrumbItem>
                    {isSettingsRoute ? (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>Instellingen</BreadcrumbItem>
                        </>
                    ) : isMembersRoute ? (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>Leden</BreadcrumbItem>
                        </>
                    ) : farmBalanceRouteType ? (
                        <>
                            <BreadcrumbSeparator className="hidden xl:block" />
                            <BreadcrumbItem className="hidden xl:block">
                                <BreadcrumbLink
                                    href={`/organization/${selectedOrganizationSlug}/${params.calendar}/balance/nitrogen`}
                                >
                                    Balans
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <DropdownMenu>
                                    <DropdownMenuTrigger className="flex items-center gap-1 max-w-[120px] sm:max-w-[200px] md:max-w-none outline-none">
                                        <span className="truncate">
                                            {farmBalanceRouteType === "nitrogen"
                                                ? "Stikstof"
                                                : "Organische stof"}
                                        </span>
                                        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuCheckboxItem
                                            checked={
                                                farmBalanceRouteType ===
                                                "nitrogen"
                                            }
                                            key={"nitrogen"}
                                        >
                                            <NavLink
                                                to={`/organization/${selectedOrganizationSlug}/${params.calendar}/balance/nitrogen${location.search}`}
                                            >
                                                Stikstof
                                            </NavLink>
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={
                                                farmBalanceRouteType ===
                                                "organic-matter"
                                            }
                                            key={"organic-matter"}
                                        >
                                            <NavLink
                                                to={`/organization/${selectedOrganizationSlug}/${params.calendar}/balance/organic-matter${location.search}`}
                                            >
                                                Organische stof
                                            </NavLink>
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </BreadcrumbItem>
                        </>
                    ) : isFarmsRoute ? (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>Bedrijven</BreadcrumbItem>
                        </>
                    ) : null}
                </>
            )}
        </>
    )
}

type HeaderOrganizationOption = {
    slug: string
    name: string | undefined | null
}
