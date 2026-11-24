import { cn } from "cn"

/**
 * The outer container of a page inside an app shell (farm, organization, user, support).
 *
 * The shell already renders the page's only `main` landmark through `SidebarInset`, so a page
 * uses this plain container for its header and content instead of a second `SidebarInset` or a
 * nested `main`. It keeps the same flex layout, so the page fills the shell.
 */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("relative flex w-full flex-1 flex-col", className)} {...props} />
}
