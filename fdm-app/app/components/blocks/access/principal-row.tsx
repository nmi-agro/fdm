import type React from "react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import { BadgeCheck } from "lucide-react"
import { useFetcher } from "react-router"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"

// Define the props type based on usage in the original file
type PrincipalRowProps = {
  username: string
  displayUserName: string | null
  image?: string | null
  initials: string
  role: "owner" | "advisor" | "researcher"
  type: "user" | "organization"
  status: "active" | "pending"
  invitation_id?: string
  invitation_expires_at?: Date | string
  hasSharePermission: boolean
  isVerificationProvider: boolean
  isLastVerificationProvider: boolean
  farmName: string | null
}

export const PrincipalRow = ({
  username,
  displayUserName,
  image,
  initials,
  role,
  type,
  status,
  invitation_id,
  invitation_expires_at,
  hasSharePermission,
  isVerificationProvider,
  isLastVerificationProvider,
  farmName,
}: PrincipalRowProps) => {
  const fetcher = useFetcher()

  // Reflect the in-flight submission optimistically; fall back to the server value otherwise.
  const selectedRole = (fetcher.formData?.get("role") as typeof role | null) ?? role

  // Handler for removing the user/principal
  const handleRemove = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    void fetcher.submit(
      {
        username: username,
        intent: "remove_user",
        ...(invitation_id ? { invitation_id } : {}),
      },
      { method: "post" },
    )
  }

  const removeButton = (
    <Button
      type={isLastVerificationProvider ? "button" : "submit"}
      variant="destructive"
      className="shrink-0"
      name={isLastVerificationProvider ? undefined : "intent"}
      value={isLastVerificationProvider ? undefined : "remove_user"}
      disabled={fetcher.state !== "idle"}
      onClick={isLastVerificationProvider ? undefined : handleRemove}
    >
      Verwijder
    </Button>
  )

  const isPending = status === "pending"

  const farmLabel = farmName || "dit bedrijf"

  const expiryLabel =
    isPending && invitation_expires_at
      ? formatDistanceToNow(new Date(invitation_expires_at), {
          locale: nl,
          addSuffix: true,
        })
      : null

  return (
    <div className="flex items-center justify-between space-x-4">
      <div className="flex items-center space-x-4">
        <Avatar>
          <AvatarImage src={image ?? undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm leading-none font-medium">{displayUserName}</p>
          <div className="flex items-center space-x-2">
            {isPending ? (
              <p className="text-muted-foreground text-sm">
                Uitnodiging
                {expiryLabel ? ` · verloopt ${expiryLabel}` : ""}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {type === "user"
                  ? "Gebruiker"
                  : type === "organization"
                    ? "Organisatie"
                    : "Onbekend"}
              </p>
            )}
            {isVerificationProvider && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="mt-2 gap-1 border-green-600 text-green-700">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {isLastVerificationProvider ? "Enige verificatiehouder" : "Verificatiehouder"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {isLastVerificationProvider
                    ? "Als deze gebruiker wordt verwijderd, verliest dit bedrijf de geverifieerde status."
                    : "Deze gebruiker heeft dit bedrijf via eHerkenning geverifieerd."}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      {hasSharePermission ? (
        <fieldset
          // Disable fieldset during submission
          disabled={fetcher.state !== "idle"}
          className="flex items-center space-x-4"
        >
          {/* Show spinner during submission */}
          {fetcher.state !== "idle" ? <Spinner /> : null}

          {isPending ? (
            <Badge>
              {role === "owner"
                ? "Eigenaar"
                : role === "advisor"
                  ? "Adviseur"
                  : role === "researcher"
                    ? "Onderzoeker"
                    : "Onbekend"}
            </Badge>
          ) : (
            <Select
              value={selectedRole}
              name="role"
              onValueChange={(value) => {
                const formData = new FormData()
                formData.append("intent", "update_role")
                formData.append("username", username)
                formData.append("role", value)
                fetcher.submit(formData, { method: "POST" })
              }}
              disabled={fetcher.state !== "idle"}
            >
              <SelectTrigger className="ml-auto w-37.5">
                <SelectValue placeholder="Selecteer rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Eigenaar</SelectItem>
                <SelectItem value="advisor">Adviseur</SelectItem>
                <SelectItem value="researcher">Onderzoeker</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Button to trigger removal */}
          {isLastVerificationProvider ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>{removeButton}</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Laatste verificatiehouder verwijderen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deze gebruiker is de enige gebruiker die {farmLabel} via eHerkenning heeft
                    geverifieerd. Als u deze gebruiker verwijdert, verliest {farmLabel} direct de
                    geverifieerde status. Weet u zeker dat u de toegang van deze gebruiker wilt
                    verwijderen?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemove}>Verwijderen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            removeButton
          )}
        </fieldset>
      ) : (
        // Display role as Badge if user doesn't have permission to change it
        <p className="text-sm leading-none font-medium">
          <Badge>
            {role === "owner"
              ? "Eigenaar"
              : role === "advisor"
                ? "Adviseur"
                : role === "researcher"
                  ? "Onderzoeker"
                  : "Onbekend"}
          </Badge>
        </p>
      )}
    </div>
  )
}
