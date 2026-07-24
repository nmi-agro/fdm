import type { SavedReplySummary } from "@nmi-agro/fdm-helpdesk"
import { Pencil, Trash2 } from "lucide-react"
import { NavLink, useFetcher } from "react-router"
import { cn } from "@/app/lib/utils"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Spinner } from "~/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip"
import { HelpdeskUserAvatar } from "./helpdesk-user"
import { HelpdeskUser } from "./types"

type SavedReplyExtended = SavedReplySummary

export function HelpdeskSavedReplyTable({
  savedReplies,
  principal_id,
  isAdmin,
  principalLookup,
}: {
  savedReplies: SavedReplyExtended[]
  principal_id: string
  isAdmin: boolean
  principalLookup: Map<string, HelpdeskUser>
}) {
  return (
    <Card className="mx-auto max-w-5xl">
      <CardHeader className="flex flex-row items-center gap-2">
        <CardTitle className="grow">Saved Replies</CardTitle>
        <Button asChild>
          <NavLink to="/support/settings/saved-replies/new">Nieuwe sjabloon aanmaken</NavLink>
        </Button>
      </CardHeader>
      <CardContent className="first:pt-6">
        {savedReplies.length > 0 ? (
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead colSpan={3}>Gemaakt door</TableHead>
                <TableHead colSpan={2} className="text-center">
                  Acties
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {savedReplies.map((savedReply) => (
                <SavedReplyRow
                  key={savedReply.reply_id}
                  savedReply={savedReply}
                  canModify={isAdmin || savedReply.created_by === principal_id}
                  principalLookup={principalLookup}
                />
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Geen sjablonen gevonden</EmptyTitle>
              <EmptyDescription>
                Maak nieuwe sjablonen aan om ze te kunnen gebruiken.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <NavLink to="/support/settings/saved-replies/new">
                  Maak een nieuw sjabloon aan
                </NavLink>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}

export interface SavedReplyRowProps {
  savedReply: SavedReplyExtended
  canModify: boolean
  principalLookup: Map<string, HelpdeskUser>
}

export function SavedReplyRow({ savedReply, canModify, principalLookup }: SavedReplyRowProps) {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== "idle"

  return (
    <TableRow>
      <TableCell className="align-middle" width="99%">
        <Button variant="link" className="px-0 text-nowrap" asChild>
          <NavLink to={`/support/settings/saved-replies/${savedReply.reply_id}`}>
            {savedReply.title}
          </NavLink>
        </Button>
      </TableCell>
      <TableCell className="align-middle">
        <HelpdeskUserAvatar user={principalLookup.get(savedReply.created_by)} type="agent" />
      </TableCell>
      <TableCell className="align-middle text-nowrap">
        {principalLookup.get(savedReply.created_by)?.displayUserName ?? "Onbekend"}
      </TableCell>
      <TableCell>
        <Spinner className={cn(fetcher.state === "idle" && "invisible")} />
      </TableCell>
      {canModify && (
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" asChild>
                <NavLink to={`/support/settings/saved-replies/${savedReply.reply_id}`}>
                  <Pencil aria-label="Bijwerken" />
                </NavLink>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bijwerken</TooltipContent>
          </Tooltip>
        </TableCell>
      )}
      {canModify && (
        <TableCell className="text-end align-middle">
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" disabled={isSubmitting}>
                    <Trash2 aria-label="Verwijderen" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Verwijderen</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deze actie kan niet ongedaan worden gemaakt. Het sjabloon wordt van alle tickets
                  verwijderd.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>Annuleren</AlertDialogCancel>
                <fetcher.Form method="POST">
                  <input type="hidden" name="reply_id" value={savedReply.reply_id} />
                  <Button
                    type="submit"
                    name="intent"
                    value="delete_saved_reply"
                    variant="destructive"
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <Spinner />
                        <span>Verwijderen</span>
                      </div>
                    ) : (
                      "Verwijderen"
                    )}
                  </Button>
                </fetcher.Form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TableCell>
      )}
    </TableRow>
  )
}
