import { motion } from "framer-motion"
import { Slot } from "radix-ui"
import {
    type ButtonHTMLAttributes,
    createContext,
    type Dispatch,
    type HTMLAttributes,
    type ReactNode,
    type SetStateAction,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
} from "react"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"

interface ExpandableContext {
    expanded: boolean
    setExpanded: Dispatch<SetStateAction<boolean>>
    isOverflowing: boolean
    setIsOverflowing: Dispatch<SetStateAction<boolean>>
}

const ctx = createContext<ExpandableContext>({
    expanded: true,
    setExpanded() {
        console.warn("ExpandableTrigger being used without parent Expandable")
    },
    isOverflowing: true,
    setIsOverflowing() {
        console.warn("ExpandableTrigger being used without parent Expandable")
    },
})

export function Expandable({ children }: { children: ReactNode }) {
    const [expanded, setExpanded] = useState(false)
    const [isOverflowing, setIsOverflowing] = useState(false)

    return (
        <ctx.Provider
            value={{ expanded, setExpanded, isOverflowing, setIsOverflowing }}
        >
            {children}
        </ctx.Provider>
    )
}

type ExpandableTriggerProps =
    | ({ asChild?: false } & ButtonHTMLAttributes<HTMLButtonElement>)
    | { asChild: true; children: ReactNode }
export function ExpandableTrigger(props: ExpandableTriggerProps) {
    const { expanded, setExpanded, isOverflowing } = useContext(ctx)
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
            className={cn(
                "-ms-4 transition-opacity duration-300 text-muted-foreground",
                !isOverflowing && "opacity-0",
            )}
            onClick={() => setExpanded((prev) => !prev)}
        >
            {expanded ? "Toon minder" : "Lees werder"}
        </Button>
    )
}

type ExpandableContentProps = HTMLAttributes<HTMLDivElement> & {
    collapsedClassName?: string
    expandedClassName?: string
}
export function ExpandableContent(props: ExpandableContentProps) {
    const { expanded, setIsOverflowing } = useContext(ctx)
    const [isAnimating, setIsAnimating] = useState(true)
    const textRef = useRef<HTMLDivElement>(null)

    const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null)
    const [fullHeight, setFullHeight] = useState<number | null>(null)

    // Measure the expanded height to decide to show the expansion button
    // biome-ignore lint/correctness/useExhaustiveDependencies: children are only used to trigger the effect
    useLayoutEffect(() => {
        const el = textRef.current
        if (!el) return

        // Force collapsed measurement
        el.classList.add("line-clamp-3")
        const collapsed = el.clientHeight
        const scroll = el.scrollHeight

        setCollapsedHeight(collapsed)
        setFullHeight(scroll)

        // Overflow only depends on collapsed state
        setIsOverflowing(scroll > collapsed + 1)

        el.classList.remove("line-clamp-3")
    }, [props.children])

    const ellipsis = !expanded && !isAnimating
    const className = cn(
        ellipsis ? "overflow-ellipsis line-clamp-3" : "overflow-clip",
        props.className,
        expanded ? props.expandedClassName : props.collapsedClassName,
    )

    // If height isn't measured yet show the collapsed variant
    if (fullHeight === null) {
        return (
            <div className="w-full">
                <div ref={textRef} className={className}>
                    {props.children}
                </div>
            </div>
        )
    }

    return (
        <motion.div
            initial={false}
            animate={{
                height: expanded
                    ? (fullHeight ?? "auto")
                    : (collapsedHeight ?? "auto"),
            }}
            onAnimationStart={() => setIsAnimating(true)}
            onAnimationComplete={() => {
                setIsAnimating(false)
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
        >
            <div {...props} ref={textRef} className={className} />
        </motion.div>
    )
}
