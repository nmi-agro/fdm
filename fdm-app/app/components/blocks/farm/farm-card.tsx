import { ArrowRight, Building, House } from "lucide-react"
import { NavLink } from "react-router"
import { Badge } from "~/components/ui/badge"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"

type Role = "owner" | "advisor" | "researcher"
interface Farm {
    b_id_farm: string
    b_name_farm: string | null
    b_address_farm: string | null
    b_postalcode_farm: string | null
    b_businessid_farm: string | null
    userRoles: Role[]
    organizationRoles?: Role[]
    organization?: {
        slug: string
        name: string
    }
}

export function FarmCard({ farm }: { farm: Farm }) {
    return (
        <Card className="group relative flex flex-col transition-all hover:border-primary/50 hover:shadow-md">
            <NavLink
                to={`/farm/${farm.b_id_farm}`}
                className="flex h-full flex-col"
            >
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                                <House className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">
                                    {farm.b_name_farm ?? "Onbekend"}
                                </CardTitle>
                                <div className="mt-1 flex gap-1">
                                    {farm.organization && (
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px] uppercase tracking-wider"
                                        >
                                            <Building className="h-4 w-4" />{" "}
                                            {farm.organization.name}
                                        </Badge>
                                    )}
                                    {(farm.organization
                                        ? (farm.organizationRoles ?? [])
                                        : farm.userRoles
                                    ).map((role) => (
                                        <Badge
                                            key={role}
                                            variant="secondary"
                                            className="text-[10px] uppercase tracking-wider"
                                        >
                                            {role === "owner"
                                                ? "Eigenaar"
                                                : role === "advisor"
                                                  ? "Adviseur"
                                                  : role === "researcher"
                                                    ? "Onderzoeker"
                                                    : "Lid"}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grow py-4">
                    <dl className="grid gap-2 text-sm text-left">
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Adres</dt>
                            <dd className="font-medium text-right">
                                {farm.b_address_farm || "Onbekend"}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Postcode</dt>
                            <dd className="font-medium text-right">
                                {farm.b_postalcode_farm || "Onbekend"}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">KvK</dt>
                            <dd className="font-medium text-right">
                                {farm.b_businessid_farm || "Onbekend"}
                            </dd>
                        </div>
                    </dl>
                </CardContent>
                <CardFooter className="border-t bg-muted/50 py-3 group-hover:bg-primary/5">
                    <span className="flex items-center text-sm font-semibold text-primary transition-transform group-hover:translate-x-1">
                        Selecteer bedrijf{" "}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </span>
                </CardFooter>
            </NavLink>
        </Card>
    )
}
