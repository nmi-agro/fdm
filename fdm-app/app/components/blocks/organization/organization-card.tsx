import { ArrowRight, Building } from "lucide-react"
import { NavLink } from "react-router"
import { Badge } from "~/components/ui/badge"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    getOrganizationRoleLabel,
    type ParseOrganizationMetadataResult,
} from "~/lib/organization-helpers"

type OrganizationRole = "owner" | "admin" | "member"
export interface OrganizationWithRoles {
    slug: string
    name: string | null
    metadata: ParseOrganizationMetadataResult
    userRoles: OrganizationRole[]
}

export function OrganizationCard({
    organization,
}: {
    organization: OrganizationWithRoles
}) {
    return (
        <Card className="group relative flex flex-col transition-all hover:border-primary/50 hover:shadow-md">
            <NavLink
                to={`/organization/${organization.slug}`}
                className="flex h-full flex-col"
            >
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                                <Building className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">
                                    {organization.name}
                                </CardTitle>
                                <div className="mt-1 flex gap-1">
                                    {organization.userRoles.map((role) => (
                                        <Badge
                                            key={role}
                                            variant="secondary"
                                            className="text-[10px] uppercase tracking-wider"
                                        >
                                            {getOrganizationRoleLabel(role)}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grow py-4">
                    <p className="grid gap-2 text-sm text-left">
                        {organization.metadata?.data?.description ??
                            organization.metadata?.error?.message ??
                            "Geen info"}
                    </p>
                </CardContent>
                <CardFooter className="border-t bg-muted/50 py-3 group-hover:bg-primary/5">
                    <span className="flex items-center text-sm font-semibold text-primary transition-transform group-hover:translate-x-1">
                        Selecteer organisatie{" "}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </span>
                </CardFooter>
            </NavLink>
        </Card>
    )
}
