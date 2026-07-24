import type { ReactNode } from "react"
import {
  type FertilizerKind,
} from "~/components/blocks/fertilizer/utils"
import { FertilizerIcon } from "~/components/custom/fertilizer-icon"
import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"

export const FERTILIZER_CATEGORY_SOLID_CLASSES: Record<FertilizerKind, string> = {
  renure: "bg-purple-600 text-white hover:bg-purple-700 border-transparent",
  manure: "bg-amber-600 text-white hover:bg-amber-700 border-transparent",
  compost: "bg-green-600 text-white hover:bg-green-700 border-transparent",
  mineral: "bg-blue-600 text-white hover:bg-blue-700 border-transparent",
  other: "bg-gray-600 text-white hover:bg-gray-700 border-transparent",
}

export interface FertilizerBadgeProps {
  p_type?: string | null
  variant?: "category-solid" | "outline" | "secondary"
  showIcon?: boolean
  dimmed?: boolean
  className?: string
  children?: ReactNode
}

export function FertilizerBadge({
  p_type,
  variant = "outline",
  showIcon = false,
  dimmed = false,
  className,
  children,
}: FertilizerBadgeProps) {
  const kind = (p_type as FertilizerKind) ?? "other"
  const badgeVariant = variant === "category-solid" ? "outline" : variant
  const categoryClass =
    variant === "category-solid"
      ? (FERTILIZER_CATEGORY_SOLID_CLASSES[kind] ?? FERTILIZER_CATEGORY_SOLID_CLASSES.other)
      : ""

  return (
    <Badge
      variant={badgeVariant}
      className={cn(
        showIcon && "gap-1",
        variant === "outline" && "text-muted-foreground",
        categoryClass,
        dimmed && "opacity-60",
        className,
      )}
    >
      {showIcon && <FertilizerIcon p_type={p_type} dimmed={dimmed} />}
      {children}
    </Badge>
  )
}
