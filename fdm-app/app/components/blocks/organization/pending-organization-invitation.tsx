import { Bell, Check, X } from "lucide-react"
import { Form } from "react-router"
import type { auth } from "@/app/lib/auth.server"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"

type Props = {
    invitation: Awaited<ReturnType<typeof auth.api.listUserInvitations>>[number]
}

function getRoleLabel(role: string): string {
    if (role === "owner") return "Eigenaar"
    if (role === "admin") return "Beheerder"
    if (role === "member") return "Lid"
    return "Lid"
}

export function PendingOrganizationInvitationCard({ invitation }: Props) {
    const organizationLabel =
        invitation.organizationName ?? invitation.organizationId

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                        <Bell className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-base">
                            {organizationLabel}
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Rol: {getRoleLabel(invitation.role)}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grow py-2 text-sm text-muted-foreground">
                Je hebt een uitnodiging ontvangen voor toegang tot organisatie{" "}
                {organizationLabel} als {getRoleLabel(invitation.role)}. Je kunt
                deze uitnodiging accepteren of weigeren.
            </CardContent>
            <CardFooter className="flex gap-2 pt-2">
                <Form method="post" className="flex-1">
                    <input
                        type="hidden"
                        name="intent"
                        value="accept_organization_invitation"
                    />
                    <input
                        type="hidden"
                        name="invitation_id"
                        value={invitation.id}
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
                        value="decline_organization_invitation"
                    />
                    <input
                        type="hidden"
                        name="invitation_id"
                        value={invitation.id}
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
