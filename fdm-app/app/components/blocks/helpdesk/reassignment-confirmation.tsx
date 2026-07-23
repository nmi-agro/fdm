import { useEffect, useId, useRef, useState, type ComponentProps } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"

/**
 * A button that can show a ticket reassignment confirmation dialog before
 * submitting its form / calling the `onConfirmation` callback.
 */
export function SubmitButtonWithReassignmentConfirmation({
  needsConfirmation,
  person,
  type,
  onConfirmation,
  ...buttonProps
}: Omit<ComponentProps<typeof Button>, "type"> & {
  /**
   * Type of the button. It needs to be defined explicitly. A value of "submit" has special meaning and
   * will cause a hidden submit button input to be rendered within the inline part of the component
   * (so not the dialog portal part). Thanks to this the button can natively submit its form once the user
   * confirms.
   */
  type: Exclude<ComponentProps<typeof Button>["type"], undefined>
  /**
   * Whether to show a dialog before submitting or calling `onConfirmation.`
   */
  needsConfirmation: boolean
  /**
   * Whether to use second-person or third-person style in the dialog text.
   */
  person: "second" | "third"
  /**
   * Function to call when the user confirms the action using the dialog, or just when the button is clicked
   * if no confirmation was necessary.
   */
  onConfirmation?: () => void
}) {
  // So that the form can be submitted when JS is disabled
  const [iNeedConfirmation, setINeedConfirmation] = useState(false)
  useEffect(() => {
    setINeedConfirmation(needsConfirmation)
  }, [needsConfirmation])

  // Alert dialog should close when submission succeeds
  const [open, setOpen] = useState(false)

  const submitButtonId = useId()
  const hiddenSubmitRef = useRef<HTMLInputElement>(null)

  if (!iNeedConfirmation) {
    return (
      <div>
        <Button
          {...buttonProps}
          onClick={(e) => {
            buttonProps.onClick?.(e)
            onConfirmation?.()
          }}
          type={type}
        />
      </div>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <div>
        <AlertDialogTrigger asChild>
          <Button {...buttonProps} type="button" />
        </AlertDialogTrigger>
        <input
          ref={hiddenSubmitRef}
          type={type === "submit" ? "submit" : "button"}
          id={submitButtonId}
          className="hidden"
        />
      </div>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
          {person === "second" && (
            <AlertDialogDescription>Jouw tickets worden opnieuw toegewezen.</AlertDialogDescription>
          )}
          {person === "third" && (
            <AlertDialogDescription>De tickets worden opnieuw toegewezen.</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <Button
            type="button"
            onClick={() => {
              setOpen(false)
              onConfirmation?.()
              hiddenSubmitRef.current?.click()
            }}
          >
            Bevestigen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
