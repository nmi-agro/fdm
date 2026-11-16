import { cn } from "cn"
import { Loader2Icon } from "lucide-react"
import { memo } from "react"

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
