import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import { Bell, Check, Clock, X } from "lucide-react"
import { useFetcher } from "react-router"
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Field } from "~/components/ui/field"
import { Spinner } from "~/components/ui/spinner"
import { getOrganizationRoleLabel } from "~/lib/organization-helpers"

type Props = {
  invitation: Awaited<ReturnType<typeof auth.api.listUserInvitations>>[number]
}

export function PendingOrganizationInvitationCard({ invitation }: Props) {
  const acceptFetcher = useFetcher()
  const declineFetcher = useFetcher()
  const isPending = acceptFetcher.state !== "idle" || declineFetcher.state !== "idle"
  const organizationLabel = invitation.organizationName ?? invitation.organizationId
  const expiresText = formatDistanceToNow(invitation.expiresAt, {
    addSuffix: true,
    locale: nl,
  })

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{organizationLabel}</CardTitle>
            <CardDescription className="text-xs">
              Rol: {getOrganizationRoleLabel(invitation.role)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-muted-foreground grow text-sm">
        Je hebt een uitnodiging ontvangen voor toegang tot organisatie {organizationLabel} als{" "}
        {getOrganizationRoleLabel(invitation.role)}. Je kunt deze uitnodiging accepteren of
        weigeren.
        <div className="text-muted-foreground/80 mt-2 flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          <span>Verloopt {expiresText}</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <acceptFetcher.Form method="post" className="flex-1">
          <input type="hidden" name="intent" value="accept_organization_invitation" />
          <input type="hidden" name="invitation_id" value={invitation.id} />
          <Button type="submit" size="sm" className="w-full" disabled={isPending}>
            {acceptFetcher.state !== "idle" ? (
              <Spinner className="mr-1 h-3 w-3" />
            ) : (
              <Check className="mr-1 h-3 w-3" />
            )}
            <span>Accepteren</span>
          </Button>
        </acceptFetcher.Form>
        <Dialog>
          <DialogTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={isPending}
              >
                <X className="mr-1 h-3 w-3" />
                <span>Weigeren</span>
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Uitnodiging weigeren</DialogTitle>
              <DialogDescription>
                Weet je zeker dat je de uitnodiging van {invitation.organizationName} wilt weigeren?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <declineFetcher.Form method="post">
                <Field orientation="horizontal">
                  <input type="hidden" name="intent" value="decline_organization_invitation" />
                  <input type="hidden" name="invitation_id" value={invitation.id} />
                  <Button
                    variant="default"
                    type="submit"
                    name="intent"
                    value="decline_organization_invitation"
                    size="sm"
                    disabled={isPending}
                  >
                    {declineFetcher.state !== "idle" && <Spinner />}
                    <span>Ja, weigeren</span>
                  </Button>
                  <DialogClose
                    render={
                      <Button type="button" variant="outline" size="sm">
                        Nee, sluiten
                      </Button>
                    }
                  />
                </Field>
              </declineFetcher.Form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}
