import { create } from "zustand"

interface CalendarState {
  calendar: string | undefined
  setCalendar: (calendar: string | undefined) => void
}

// Get current year
const currentYear = new Date().getFullYear().toString()

export const useCalendarStore = create<CalendarState>((set) => ({
  calendar: currentYear, // Initial calendar is current year
  setCalendar: (calendar) => set({ calendar: calendar ? calendar : currentYear }),
}))

/**
 * Returns `true` if it fully handled the jump (the caller should skip its normal navigation);
 * `false` if the requested year couldn't be handled (e.g. outside the supported range) and the
 * caller should fall back to a normal navigation instead.
 */
type CalendarJumpHandler = (year: string) => boolean

interface CalendarJumpState {
  jumpToYear: CalendarJumpHandler | null
  registerJumpToYear: (handler: CalendarJumpHandler) => () => void
}

/**
 * Lets the currently-mounted timeline page register a handler that lets the sidebar's Calendar
 * year selector "jump" (scroll the already-loaded timeline to that year) instead of triggering a
 * full page navigation. Only the timeline route registers a handler; every other route leaves
 * `jumpToYear` `null`, so the sidebar falls back to its normal navigation everywhere else.
 */
export const useCalendarJump = create<CalendarJumpState>((set, get) => ({
  jumpToYear: null,
  registerJumpToYear: (handler) => {
    set({ jumpToYear: handler })
    return () => {
      // Only clear if a newer registration (e.g. a fast remount) hasn't already replaced us.
      if (get().jumpToYear === handler) {
        set({ jumpToYear: null })
      }
    }
  },
}))
