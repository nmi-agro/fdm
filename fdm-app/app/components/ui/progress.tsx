import { Progress as ProgressPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "~/lib/utils"

const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
        colorBar?: string
    }
>(({ className, value, colorBar, ...props }, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        className={cn(
            "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
            className,
        )}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className={cn(
                "h-full w-full flex-1 bg-primary transition-all",
                colorBar && `bg-${colorBar}`,
            )}
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
