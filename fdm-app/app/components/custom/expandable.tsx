import { Slot } from "radix-ui"
import {
    type ButtonHTMLAttributes,
    createContext,
    type Dispatch,
    type HTMLAttributes,
    type ReactNode,
    type SetStateAction,
    useContext,
    useState,
} from "react"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"

interface ExpandableContext {
    expanded: boolean
    setExpanded: Dispatch<SetStateAction<boolean>>
}

const ctx = createContext<ExpandableContext>({
    expanded: true,
    setExpanded() {
        console.warn("ExpandableTrigger being used without parent Expandable")
    },
})

export function Expandable({ children }: { children: ReactNode }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <ctx.Provider value={{ expanded, setExpanded }}>
            {children}
        </ctx.Provider>
    )
}

type ExpandableTriggerProps =
    | ({ asChild?: false } & ButtonHTMLAttributes<HTMLButtonElement>)
    | { asChild: true; children: ReactNode }
export function ExpandableTrigger(props: ExpandableTriggerProps) {
    const { expanded, setExpanded } = useContext(ctx)
    const myProps = {
        onClick() {
            setExpanded(!expanded)
        },
    }
    return props.asChild ? (
        <Slot {...props} {...myProps} />
    ) : (
        <Button
            variant="link"
            className={cn("-ms-4", props.className)}
            {...myProps}
        >
            {expanded ? "Lees minder" : "Lees werder"}
        </Button>
    )
}

type ExpandableContentProps = HTMLAttributes<HTMLDivElement> & {
    collapsedClassName?: string
    expandedClassName?: string
}
export function ExpandableContent(props: ExpandableContentProps) {
    const { expanded } = useContext(ctx)
    return (
        <div
            {...props}
            className={cn(
                !expanded && "line-clamp-3 overflow-ellipsis",
                expanded && "overflow-clip",
                props.className,
                expanded ? props.expandedClassName : props.collapsedClassName,
            )}
        />
    )
}
