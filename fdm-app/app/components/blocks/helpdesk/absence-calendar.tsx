import { format, getDay, parse, startOfWeek } from "date-fns"
import { nl } from "date-fns/locale"
import { useMemo } from "react"
import { Calendar, dateFnsLocalizer, type SlotInfo } from "react-big-calendar"
import "react-big-calendar/lib/css/react-big-calendar.css"
import { getAgentColor } from "./absence-colors"
import { ABSENCE_REASON_LABELS } from "./absence-schema"

const locales = { nl: nl }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: nl }),
  getDay,
  locales,
})

export interface AbsenceCalendarItem {
  absence_id: string
  agent_id: string
  display_name: string
  start_date: Date
  end_date: Date
  reason: string
  note: string | null
}

export interface AbsenceCalendarEvent {
  absence_id: string
  agent_id: string
  display_name: string
  reason: string
  note: string | null
  title: string
  start: Date
  end: Date
  allDay: true
}

export function AbsenceCalendar({
  className,
  agent_id,
  absences,
  onSelectAbsence,
  onSelectSlot,
}: {
  className?: string
  agent_id: string
  absences: AbsenceCalendarItem[]
  onSelectAbsence: (absence: AbsenceCalendarItem) => void
  onSelectSlot: (range: { start: Date; end: Date }) => void
}) {
  const events = useMemo<AbsenceCalendarEvent[]>(
    () =>
      absences.map((absence) => ({
        absence_id: absence.absence_id,
        agent_id: absence.agent_id,
        display_name: absence.display_name,
        reason: absence.reason,
        note: absence.note,
        title: `${absence.display_name} — ${ABSENCE_REASON_LABELS[absence.reason as keyof typeof ABSENCE_REASON_LABELS] ?? absence.reason}`,
        start: absence.start_date,
        // react-big-calendar treats the end date of an all-day event as exclusive, so a single-day
        // absence (start === end) needs its end pushed forward one day to actually render.
        end: absence.end_date,
        allDay: true,
      })),
    [absences],
  )

  const absenceById = useMemo(
    () => new Map(absences.map((absence) => [absence.absence_id, absence])),
    [absences],
  )

  return (
    <Calendar<AbsenceCalendarEvent>
      className={className}
      localizer={localizer}
      culture="nl"
      events={events}
      startAccessor="start"
      endAccessor="end"
      titleAccessor="title"
      views={["month"]}
      defaultView="month"
      selectable
      popup
      style={{ height: 720 }}
      messages={calendarMessages}
      eventPropGetter={(event) => {
        const colors = getAgentColor(event.agent_id, event.agent_id === agent_id)
        return {
          style: {
            backgroundColor: colors.background,
            border: `1px solid ${colors.border}`,
            color: colors.text,
          },
        }
      }}
      onSelectEvent={(event) => {
        const absence = absenceById.get(event.absence_id)
        if (absence) onSelectAbsence(absence)
      }}
      onSelectSlot={(slotInfo: SlotInfo) => {
        // In month/week "day cell" selections, react-big-calendar's `end` is exclusive (the day
        // *after* the last selected day) and `slots` lists every selected day at local midnight.
        // Using the last entry of `slots` instead of `end` gives the actual last selected day,
        // regardless of the exclusive-end convention or the viewer's timezone.
        const start = slotInfo.slots[0] ?? slotInfo.start
        const end = slotInfo.slots[slotInfo.slots.length - 1] ?? slotInfo.start
        onSelectSlot({ start, end })
      }}
    />
  )
}

const calendarMessages = {
  date: "Datum",
  time: "Tijd",
  event: "Afwezigheid",
  allDay: "Hele dag",
  week: "Week",
  work_week: "Werkweek",
  day: "Dag",
  month: "Maand",
  previous: "Vorige",
  next: "Volgende",
  yesterday: "Gisteren",
  tomorrow: "Morgen",
  today: "Vandaag",
  agenda: "Agenda",
  noEventsInRange: "Geen afwezigheden in deze periode.",
  showMore: (total: number) => `+${total} meer`,
}
