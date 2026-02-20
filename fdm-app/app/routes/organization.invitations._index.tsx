import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import { Form, NavLink, useLoaderData } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/organization.invitations._index"

// Meta
export const meta: Route.MetaFunction = () => {
    return [
        {
            title: `Uitnodigingen - Organisaties | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk en bewerk de gegevens van je organisatie.",
        },
    ]
}

export async function loader({ request }: Route.LoaderArgs) {
    try {
        await getSession(request)

        const invitationsList = await auth.api.listUserInvitations({
            headers: request.headers,
        })

        const invitations = await Promise.all(
            invitationsList
                .filter((invitation) => invitation.status === "pending")
                .map(async (invitation) => {
                    return await auth.api.getInvitation({
                        query: {
                            id: invitation.id,
                        },
                        headers: request.headers,
                    })
                }),
        )

        return { invitations: invitations }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function OrganizationsIndex() {
    const { invitations } = useLoaderData<typeof loader>()

    return (
        <main className="container">
            <div className="max-w-3xl mx-auto px-4">
                <div className="mb-8 flex items-center justify-between">
                    <FarmTitle
                        title={"Mijn uitnodigingen"}
                        description={
                            "Hier vind je een overzicht van alle uitnodigingen die je hebt ontvangen om lid te worden van een organisatie."
                        }
                    />
                </div>

                {invitations.length === 0 ? (
                    <div className="mx-auto flex h-full w-full items-center flex-col justify-center space-y-6 sm:w-87.5">
                        <div className="flex flex-col space-y-2 text-center">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Je hebt op dit moment geen uitnodigingen open
                                staan
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Vraag bij je contactpersoon om een uitnodiging
                                als je bij een organisatie wil.
                            </p>
                        </div>
                        <Button asChild>
                            <NavLink to="/organization">
                                Terug naar organisaties
                            </NavLink>
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 grid-cols-1">
                        {invitations.map((invitation) => (
                            <Card key={invitation.id}>
                                <CardHeader>
                                    <CardTitle>
                                        {invitation.organizationName}
                                    </CardTitle>
                                    <CardDescription>
                                        Uitgenodigd door{" "}
                                        {invitation.inviterEmail}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg leading-none">
                                        Je bent uitgenodigd als{" "}
                                        <i className="font-semibold">
                                            {invitation.role}
                                        </i>
                                    </p>
                                    <br />
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Verloopt{" "}
                                        {formatDistanceToNow(
                                            new Date(invitation.expiresAt),
                                            {
                                                addSuffix: true,
                                                locale: nl,
                                            },
                                        )}
                                    </p>
                                </CardContent>
                                <CardFooter className="flex justify-between">
                                    <Button asChild variant="outline" size="sm">
                                        <NavLink
                                            to={`/organization/${invitation.organizationId}`}
                                        >
                                            Meer info
                                        </NavLink>
                                    </Button>
                                    <div className="flex gap-2">
                                        <Form method="post">
                                            <input
                                                type="hidden"
                                                name="invitation_id"
                                                value={invitation.id}
                                            />
                                            <Button
                                                name="intent"
                                                value="accept"
                                                size="sm"
                                            >
                                                Accepteren
                                            </Button>
                                        </Form>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    Afwijzen
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>
                                                        Uitnodiging afwijzen
                                                    </DialogTitle>
                                                    <DialogDescription>
                                                        Weet je zeker dat je de
                                                        uitnodiging van{" "}
                                                        {
                                                            invitation.organizationName
                                                        }{" "}
                                                        wilt afwijzen?
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <DialogFooter>
                                                    <Form method="post">
                                                        <input
                                                            type="hidden"
                                                            name="invitation_id"
                                                            value={
                                                                invitation.id
                                                            }
                                                        />
                                                        <Button
                                                            variant="default"
                                                            name="intent"
                                                            value="reject"
                                                            size="sm"
                                                        >
                                                            Ja, afwijzen
                                                        </Button>
                                                    </Form>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </main>
    )
}

const FormSchema = z.object({
    invitation_id: z.string(),
    intent: z.enum(["accept", "reject"]),
})

export async function action({ request }: Route.LoaderArgs) {
    try {
        const formValues = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )

        // getSession call is important to validate session
        await getSession(request)

        if (formValues.intent === "accept") {
            await auth.api.acceptInvitation({
                headers: request.headers,
                body: { invitationId: formValues.invitation_id },
            })
            return redirectWithSuccess("/organization", {
                message: "Uitnodiging geaccepteerd! 🎉",
            })
        }
        if (formValues.intent === "reject") {
            await auth.api.rejectInvitation({
                headers: request.headers,
                body: { invitationId: formValues.invitation_id },
            })
            return redirectWithSuccess("/organization", {
                message: "Uitnodiging afgewezen",
            })
        }
        throw new Error("invalid intent")
    } catch (error) {
        throw handleActionError(error)
    }
}
