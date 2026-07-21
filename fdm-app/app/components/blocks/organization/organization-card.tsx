import { ArrowRight } from "lucide-react"
import { NavLink } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import {
  getOrganizationRoleLabel,
  type ParseOrganizationMetadataResult,
} from "~/lib/organization-helpers"
import { OrganizationAvatar } from "./organization-avatar"

type OrganizationRole = "owner" | "admin" | "member"
export interface OrganizationWithRoles {
  slug: string
  name: string | null
  logo?: string | null | undefined
  metadata: ParseOrganizationMetadataResult
  userRoles: OrganizationRole[]
}

export function OrganizationCard({ organization }: { organization: OrganizationWithRoles }) {
  const description = organization.metadata?.data?.description
  return (
    <Card className="group hover:border-primary/50 relative flex flex-col transition-all hover:shadow-md">
      <NavLink to={`/organization/${organization.slug}`} className="flex h-full flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <OrganizationAvatar
                src={organization.logo}
                alt={`Logo van ${organization.name}`}
                className="size-10"
              />
              <div>
                <CardTitle className="text-xl">{organization.name}</CardTitle>
                <div className="mt-1 flex gap-1">
                  {organization.userRoles.map((role) => (
                    <Badge
                      key={role}
                      variant="secondary"
                      className="text-[10px] tracking-wider uppercase"
                    >
                      {getOrganizationRoleLabel(role)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grow overflow-hidden">
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {description && description.length > 0 ? description : "Geen beschrijving"}
          </p>
        </CardContent>
        <CardFooter className="bg-muted/50 group-hover:bg-primary/5 border-t py-3">
          <span className="text-primary flex items-center text-sm font-semibold transition-transform group-hover:translate-x-1">
            Selecteer organisatie <ArrowRight className="ml-2 h-4 w-4" />
          </span>
        </CardFooter>
      </NavLink>
    </Card>
  )
}
