import { Loader2Icon } from "lucide-react"
import { memo } from "react"
import { cn } from "~/lib/utils"

const Spinner = memo(({ className, ...props }: React.ComponentProps<"svg">) => {
  return (
    <Loader2Icon
      role="status"
      aria-label="Laden"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
})
Spinner.displayName = "Spinner"

export { Spinner }
