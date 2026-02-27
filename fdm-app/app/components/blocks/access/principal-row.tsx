import { zodResolver } from "@hookform/resolvers/zod"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import type React from "react"
import { useEffect, useState } from "react"
import { useFetcher } from "react-router-dom"
import { useRemixForm } from "remix-hook-form"
import type { z } from "zod"
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
import { AccessFormSchema } from "~/lib/schemas/access.schema"

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
}: PrincipalRowProps) => {
    const fetcher = useFetcher()

    const [selectedRole, setSelectedRole] = useState(role)
    useEffect(() => {
        if (fetcher.state === "idle") {
            setSelectedRole(role)
        }
    }, [fetcher.state, role])

    const form = useRemixForm<z.infer<typeof AccessFormSchema>>({
        mode: "onSubmit",
        resolver: zodResolver(AccessFormSchema),
        defaultValues: {
            username: username,
            role: role as "owner" | "advisor" | "researcher",
            intent: "update_role", // Default intent
        },
    })

    // Handler for removing the user/principal
    const handleRemove = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        fetcher.submit(
            {
                username: username,
                intent: "remove_user",
                ...(invitation_id ? { invitation_id } : {}),
            },
            { method: "post" },
        )
    }

    // Handler for changing the role via Select dropdown
    const handleSelectChange = async (value: string) => {
        // Optimistically update displayed role
        setSelectedRole(value as "owner" | "advisor" | "researcher")
        // Update the form state immediately
        form.setValue("role", value as "owner" | "advisor" | "researcher")
        // Submit the form programmatically using the fetcher
        fetcher.submit(
            {
                username: username,
                role: value,
                intent: "update_role",
                ...(invitation_id ? { invitation_id } : {}),
            },
            { method: "post" },
        )
    }

    const isPending = status === "pending"

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
                    <p className="text-sm font-medium leading-none">
                        {displayUserName}
                    </p>
                    {isPending ? (
                        <p className="text-sm text-muted-foreground">
                            Uitnodiging
                            {expiryLabel ? ` · verloopt ${expiryLabel}` : ""}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {type === "user"
                                ? "Gebruiker"
                                : type === "organization"
                                  ? "Organisatie"
                                  : "Onbekend"}
                        </p>
                    )}
                </div>
            </div>
            {hasSharePermission ? (
                <fetcher.Form method="post">
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
                                onValueChange={handleSelectChange}
                                disabled={fetcher.state !== "idle"}
                            >
                                <SelectTrigger className="ml-auto w-37.5">
                                    <SelectValue placeholder="Selecteer rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="owner">
                                        Eigenaar
                                    </SelectItem>
                                    <SelectItem value="advisor">
                                        Adviseur
                                    </SelectItem>
                                    <SelectItem value="researcher">
                                        Onderzoeker
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        )}

                        {/* Button to trigger removal */}
                        <Button
                            type="submit" // Submit the fetcher.Form
                            variant="destructive"
                            className="shrink-0"
                            name="intent" // Set intent for this button
                            value="remove_user"
                            // Disable button while submitting
                            disabled={fetcher.state !== "idle"}
                            onClick={handleRemove}
                        >
                            Verwijder
                        </Button>
                    </fieldset>
                </fetcher.Form>
            ) : (
                // Display role as Badge if user doesn't have permission to change it
                <p className="text-sm font-medium leading-none">
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
