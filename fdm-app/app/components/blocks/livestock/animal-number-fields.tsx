import { parseCattleEartag } from "@nmi-agro/fdm-data"
import { cn } from "cn"
import { useState } from "react"
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"

/** Automatic work numbers have 5 or more digits (from 10001); real ones have 4. */
const AUTO_WORKNUMBER = /^\d{5,}$/

/** The work number in a Dutch cattle life number, or `null` when there is none. */
function deriveWorknumber(eartag: string, isCattle: boolean): string | null {
  if (!isCattle) return null
  const result = parseCattleEartag(eartag)
  return result.kind === "dutch" ? result.worknumber : null
}

/**
 * Checks the life number of a cattle animal the way fdm-core does when it is saved.
 *
 * @param eartag - The life number as entered; empty is allowed.
 * @param isCattle - Whether the animal is cattle. Other species are not checked.
 * @returns A Dutch message when the life number is invalid, otherwise `null`.
 */
export function getEartagError(eartag: string, isCattle: boolean): string | null {
  if (!isCattle || !eartag.trim()) return null
  const result = parseCattleEartag(eartag)
  if (result.kind !== "invalid") return null
  return result.reason === "check_digit"
    ? "Het laatste cijfer klopt niet bij de andere cijfers. Controleer het nummer op het oormerk."
    : "Een Nederlands levensnummer heeft 9 of 12 cijfers, met of zonder NL ervoor."
}

/**
 * Puts the focus on the levensnummer input, e.g. after a submit was stopped by an invalid number.
 *
 * @param idPrefix - The `idPrefix` given to {@link AnimalNumberFields}.
 */
export function focusEartagInput(idPrefix: string): void {
  document.getElementById(`${idPrefix}-eartag`)?.focus()
}

/**
 * The levensnummer and werknummer inputs of an animal. For cattle, the werknummer follows from a
 * Dutch levensnummer (the 4 digits before the last digit): typing a valid levensnummer fills it in,
 * unless the user typed a werknummer of their own. An automatic werknummer (5 digits or more) is
 * replaced as well. When the levensnummer stops being valid, the werknummer that was there before
 * comes back.
 */
export function AnimalNumberFields({
  idPrefix,
  eartag,
  worknumber,
  onEartagChange,
  onWorknumberChange,
  isCattle,
  showErrors = false,
  worknumberDescription,
  stacked = false,
  disabled = false,
}: {
  /** Prefix for the input ids, unique on the page. */
  idPrefix: string
  eartag: string
  worknumber: string
  onEartagChange: (value: string) => void
  onWorknumberChange: (value: string) => void
  isCattle: boolean
  /** Show the levensnummer error before the field lost focus, e.g. after a submit attempt. */
  showErrors?: boolean
  /** Help text under the werknummer, e.g. how it is filled in. */
  worknumberDescription?: string
  /** One field under the other, for narrow containers such as a dialog. */
  stacked?: boolean
  disabled?: boolean
}) {
  // The werknummer this form filled in from the levensnummer, and the one it replaced
  const [filled, setFilled] = useState<{ value: string; before: string } | null>(() => {
    const derived = deriveWorknumber(eartag, isCattle)
    return derived ? { value: derived, before: worknumber } : null
  })
  // The error waits until the user leaves the field, and hides again while they correct it
  const [eartagBlurred, setEartagBlurred] = useState(false)
  const eartagError = eartagBlurred || showErrors ? getEartagError(eartag, isCattle) : null

  const handleEartagChange = (value: string) => {
    onEartagChange(value)
    setEartagBlurred(false)
    const derived = deriveWorknumber(value, isCattle)
    const current = worknumber.trim()
    const isFilled = filled !== null && current === filled.value

    if (!derived) {
      // The levensnummer no longer gives a werknummer: undo what this form filled in
      if (isFilled) {
        onWorknumberChange(filled.before)
        setFilled(null)
      }
      return
    }
    if (isFilled || current === "" || AUTO_WORKNUMBER.test(current)) {
      onWorknumberChange(derived)
      setFilled({ value: derived, before: isFilled ? filled.before : worknumber })
    }
  }

  return (
    <div className={cn("grid grid-cols-1 gap-4", !stacked && "sm:grid-cols-2")}>
      <Field data-invalid={eartagError ? true : undefined}>
        <FieldLabel htmlFor={`${idPrefix}-eartag`}>Levensnummer</FieldLabel>
        <Input
          id={`${idPrefix}-eartag`}
          value={eartag}
          onChange={(e) => handleEartagChange(e.target.value)}
          onBlur={() => setEartagBlurred(true)}
          placeholder="NL 1234567 8901 2"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={eartagError ? true : undefined}
          aria-describedby={eartagError ? `${idPrefix}-eartag-error` : undefined}
          disabled={disabled}
        />
        {eartagError && <FieldError id={`${idPrefix}-eartag-error`}>{eartagError}</FieldError>}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-worknumber`}>Werknummer</FieldLabel>
        <Input
          id={`${idPrefix}-worknumber`}
          value={worknumber}
          onChange={(e) => onWorknumberChange(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          aria-describedby={
            worknumberDescription ? `${idPrefix}-worknumber-description` : undefined
          }
          disabled={disabled}
        />
        {worknumberDescription && (
          <FieldDescription id={`${idPrefix}-worknumber-description`}>
            {worknumberDescription}
          </FieldDescription>
        )}
      </Field>
    </div>
  )
}
