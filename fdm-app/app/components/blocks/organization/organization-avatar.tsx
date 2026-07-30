import { Building } from "lucide-react"
import { cn } from "@/app/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

export function OrganizationAvatar({
  src,
  alt,
  className,
}: {
  src: string | null | undefined
  alt: string
  className?: string
}) {
  return (
    <Avatar className={cn("rounded-lg", className)}>
      {typeof src === "string" ? <AvatarImage src={src} alt={alt} /> : undefined}
      <AvatarFallback className="rounded-lg">
        <Building className="text-muted-foreground size-3/4" />
      </AvatarFallback>
    </Avatar>
  )
}
