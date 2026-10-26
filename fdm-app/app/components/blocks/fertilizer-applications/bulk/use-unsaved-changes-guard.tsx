import { useBeforeUnload, useBlocker } from "react-router"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { buttonVariants } from "~/components/ui/button"

/**
 * Navigation state for a navigation that keeps the input as a draft, such as going to add a new
 * fertilizer. Such a navigation is not blocked.
 */
export const DRAFT_SAVED_STATE = { fertilizerDraftSaved: true } as const

/**
 * Warns before the user leaves a page with an unsaved fertilizer application.
 *
 * While `active`, the browser asks for confirmation when the page is reloaded or closed, and a
 * navigation to another page within the app opens a dialog to stay or leave. A change of only
 * the search params, such as the field selection, is not blocked, and neither is a navigation with
 * {@link DRAFT_SAVED_STATE}.
 *
 * @param active - Whether the form has unsaved input. Pass `false` while the form is submitted,
 *   so the redirect after saving is not blocked.
 * @returns The dialog, to render on the page.
 */
export function useUnsavedChangesGuard(active: boolean) {
  useBeforeUnload(
    (event) => {
      if (active) event.preventDefault()
    },
    { capture: true },
  )

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active &&
      currentLocation.pathname !== nextLocation.pathname &&
      !(nextLocation.state as typeof DRAFT_SAVED_STATE | null)?.fertilizerDraftSaved,
  )

  return (
    <AlertDialog open={blocker.state === "blocked"}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Wijzigingen niet opgeslagen</AlertDialogTitle>
          <AlertDialogDescription>
            De ingevulde gift is nog niet opgeslagen. Als u deze pagina verlaat, gaat de invoer
            verloren.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>
            Op deze pagina blijven
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => blocker.proceed?.()}
            className={buttonVariants({ variant: "destructive" })}
          >
            Pagina verlaten
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
