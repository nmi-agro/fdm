import { ChevronDown } from "lucide-react"
import { NavLink, useLocation, useMatches } from "react-router"
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
    const currentPath = String(location.pathname)

    const matches = useMatches()
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
