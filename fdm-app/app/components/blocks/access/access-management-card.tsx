import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { InvitationForm } from "./invitation-form"
import { PrincipalRow } from "./principal-row"

// Define the type for the principal object based on usage
// Ensure this matches the type definition used in InvitationForm and PrincipalRow if needed elsewhere
type Principal = {
    username: string
    displayUserName: string | null
    image?: string | null
    initials: string
    role: string
    type: "user" | "organization"
    status: "active" | "pending"
    invitation_id?: string
    invitation_expires_at?: Date | string
}

// Define props for the AccessManagementCard
type AccessManagementCardProps = {
    principals: Principal[]
    hasSharePermission: boolean
}

export const AccessManagementCard = ({
    principals,
    hasSharePermission,
}: AccessManagementCardProps) => {
    return (
        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>Toegang</CardTitle>
                <CardDescription>
                    {hasSharePermission
                        ? "Beheer welke gebruikers en organisaties toegang hebben tot dit bedrijf"
                        : "U heeft geen rechten om de toegang tot dit bedrijf te beheren."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Conditionally render InvitationForm based on permission */}
                {hasSharePermission ? (
                    <InvitationForm principals={principals} />
                ) : null}
                <Separator className="my-4" />
                <div className="space-y-4">
                    <div className="text-sm font-medium">
                        Gebruikers en organisaties met toegang tot dit bedrijf
                    </div>
                    <div className="grid gap-6">
                        {/* Map over principals to render PrincipalRow for each */}
                        {principals.map((principal) => (
                            <PrincipalRow
                                key={principal.username}
                                username={principal.username}
                                displayUserName={principal.displayUserName}
                                image={principal.image}
                                initials={principal.initials}
                                role={principal.role}
                                type={principal.type}
                                status={principal.status}
                                invitation_id={principal.invitation_id}
                                invitation_expires_at={
                                    principal.invitation_expires_at
                                }
                                hasSharePermission={hasSharePermission}
                            />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
