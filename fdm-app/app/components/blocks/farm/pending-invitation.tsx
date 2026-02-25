import { Bell, Check, X } from "lucide-react"
import { Form } from "react-router"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"

type PendingInvitation = {
    invitation_id: string
    resource_id: string
    role: string
    farm_name: string | null
    org_name: string | null
}

type Props = {
    invitation: PendingInvitation
    principalType?: "user" | "organization"
}

function getRoleLabel(role: string): string {
    if (role === "owner") return "Eigenaar"
    if (role === "advisor") return "Adviseur"
    if (role === "researcher") return "Onderzoeker"
    return "Lid"
}

export function PendingInvitationCard({
    invitation,
    principalType = "user",
}: Props) {
    const farmLabel = invitation.farm_name ?? invitation.resource_id

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                        <Bell className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-base">{farmLabel}</CardTitle>
                        <CardDescription className="text-xs">
                            Rol: {getRoleLabel(invitation.role)}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grow py-2 text-sm text-muted-foreground">
                {principalType === "organization"
                    ? `${invitation.org_name ?? "Jouw organisatie"} heeft`
                    : "Je hebt"}{" "}
                een uitnodiging ontvangen voor toegang tot bedrijf {farmLabel}{" "}
                als {getRoleLabel(invitation.role)}.
                {principalType === "user" && invitation.org_name && (
                    <span className="block text-xs text-muted-foreground">
                        Deze uitnodiging ontvang je namens organisatie:{" "}
                        {invitation.org_name}
                    </span>
                )}{" "}
                Je kunt deze uitnodiging accepteren of weigeren.
            </CardContent>
            <CardFooter className="flex gap-2 pt-2">
                <Form method="post" className="flex-1">
                    <input
                        type="hidden"
                        name="intent"
                        value="accept_farm_invitation"
                    />
                    <input
                        type="hidden"
                        name="invitation_id"
                        value={invitation.invitation_id}
                    />
                    <Button type="submit" size="sm" className="w-full">
                        <Check className="mr-1 h-3 w-3" />
                        Accepteren
                    </Button>
                </Form>
                <Form method="post" className="flex-1">
                    <input
                        type="hidden"
                        name="intent"
                        value="decline_farm_invitation"
                    />
                    <input
                        type="hidden"
                        name="invitation_id"
                        value={invitation.invitation_id}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="w-full"
                    >
                        <X className="mr-1 h-3 w-3" />
                        Weigeren
                    </Button>
                </Form>
            </CardFooter>
        </Card>
    )
}
