import type { ReactNode } from "react"
import { cn } from "@/app/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export interface DisplayUser {
    displayUserName: string | null
    image: string | null
    initials: string | null
}

/**
 * Renders a single user avatar and their name if there is one user, or a stack of the user avatars if there are multiple users.
 *
 * The fallback React node is rendered if there are no users or the users array is missing.
 *
 * @param param0 props
 * @returns a React node
 */
export function UserDisplay({
    users,
    fallback = null,
}: {
    users?: DisplayUser[]
    fallback?: ReactNode
}) {
    const TRUNCATE_AFTER = 3
    if (!users || users.length === 0) return fallback
    if (users.length === 1)
        return (
            <div className="flex flex-row items-center gap-2">
                <UserAvatar user={users[0]} />
                {users[0].displayUserName}
            </div>
        )
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <AvatarGroup>
                    {users.slice(0, TRUNCATE_AFTER).map((user, i) => (
                        <UserAvatar
                            key={`${i}_${user.displayUserName}`}
                            user={user}
                        />
                    ))}
                    {users.length > TRUNCATE_AFTER && (
                        <AvatarGroupCount>
                            +{users.length - TRUNCATE_AFTER}
                        </AvatarGroupCount>
                    )}
                </AvatarGroup>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                {users.map((user, i) => (
                    <DropdownMenuItem key={`${i}_${user.displayUserName}`}>
                        <div className="flex flex-row items-center gap-2">
                            <UserAvatar user={user} />
                            {user.displayUserName}
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

/**
 * Renders the user's avatar, or their initials if the avatar image is missing.
 *
 * @param param0 props
 * @returns a React node
 */
export function UserAvatar({ user }: { user: DisplayUser }) {
    return (
        <Avatar className="h-6 w-6 rounded-lg">
            <AvatarImage
                src={user.image ?? undefined}
                alt={user.displayUserName ?? undefined}
            />
            <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
    )
}

// TODO: Use the shadcn-provided component when it becomes available
function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="avatar-group"
            className={cn(
                "[&>*]:ring-background flex -space-x-2 [&>*]:ring-2",
                className,
            )}
            {...props}
        />
    )
}

// TODO: Use the shadcn-provided component when it becomes available
function AvatarGroupCount({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="avatar-group-count"
            className={cn(
                "bg-muted text-muted-foreground ring-background relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ring-2",
                className,
            )}
            {...props}
        />
    )
}
