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
