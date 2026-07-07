import { ArrowRight, CircleAlert, Plus } from "lucide-react"
import type { ComponentType, ReactNode } from "react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"

export function FieldDashboardSectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
        {title}
      </h2>
      <Separator className="flex-1" />
    </div>
  )
}

export function FieldDashboardTile({
  title,
  statusBadge,
  detailHref,
  detailLabel = "Bekijk details",
  className,
  contentClassName,
  footer = true,
  children,
}: {
  title: string
  statusBadge?: ReactNode
  detailHref?: string
  detailLabel?: string
  className?: string
  contentClassName?: string
  footer?: boolean
  children: ReactNode
}) {
  return (
    <Card
      className={cn(
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-reduce:animate-none",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {statusBadge ? <div className="shrink-0">{statusBadge}</div> : null}
      </CardHeader>
      <CardContent className={cn("space-y-4", contentClassName)}>{children}</CardContent>
      {footer && detailHref ? (
        <CardFooter className="border-t pt-4">
          <Link
            to={detailHref}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <span>{detailLabel}</span>
            <ArrowRight className="size-4" />
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  )
}

export function FieldDashboardTileSkeleton({
  title,
  detailHref,
}: {
  title: string
  detailHref?: string
}) {
  return (
    <FieldDashboardTile title={title} detailHref={detailHref}>
      <div className="space-y-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="grid grid-cols-3 gap-3 pt-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      </div>
    </FieldDashboardTile>
  )
}

export function FieldDashboardTileError({
  title,
  detailHref,
  message = "Deze informatie is nu niet beschikbaar.",
}: {
  title: string
  detailHref?: string
  message?: string
}) {
  return (
    <FieldDashboardTile title={title} detailHref={detailHref}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{message}</p>
        </div>
      </div>
    </FieldDashboardTile>
  )
}

export function FieldDashboardTileEmpty({
  title,
  detailHref,
  icon: Icon = Plus,
  emptyTitle,
  emptyDescription,
  action,
}: {
  title: string
  detailHref?: string
  icon?: ComponentType<{ className?: string }>
  emptyTitle: string
  emptyDescription: string
  action?: {
    href: string
    label: string
  }
}) {
  return (
    <FieldDashboardTile title={title} detailHref={detailHref}>
      <Empty className="min-h-52 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
        {action ? (
          <EmptyContent>
            <Button asChild variant="outline">
              <Link to={action.href}>{action.label}</Link>
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    </FieldDashboardTile>
  )
}
