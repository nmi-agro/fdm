import {
  cancelAbsence,
  checkHelpdeskPermission,
  getAgents,
  getAllAbsences,
  scheduleAbsence,
  updateAbsence,
} from "@nmi-agro/fdm-helpdesk"
import { endOfDay } from "date-fns/endOfDay"
import { Plus } from "lucide-react"
import { Suspense, useState } from "react"
import { Await, useLoaderData } from "react-router"
import { dataWithSuccess } from "remix-toast"
import z from "zod"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import {
  AbsenceCalendar,
  type AbsenceCalendarItem,
} from "~/components/blocks/helpdesk/absence-calendar"
import { AbsenceDialog } from "~/components/blocks/helpdesk/absence-dialog"
import {
  DeleteAbsenceSchema,
  ScheduleAbsenceSchema,
  UpdateAbsenceSchema,
} from "~/components/blocks/helpdesk/absence-schema"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/support.settings.absences"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Afwezigheid - Ondersteuning | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Beheer de afwezigheid van medewerkers op het ondersteuningsdashboard.",
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    const [agents, isAdmin] = await Promise.all([
      getAgents(fdm, session.principal_id),
      checkHelpdeskPermission(
        fdm,
        "helpdesk",
        "write",
        "",
        session.principal_id,
        "routes/support.settings.absences",
        false,
      ),
    ])

    // Absences can span an agent's entire tenure, so all of them are loaded at once. This is
    // intentionally *not* awaited here — the promise is streamed to the client and resolved
    // behind a Suspense boundary so the page shell renders immediately.
    const absencesPromise = getAllAbsences(fdm, session.principal_id)

    return {
      principal_id: session.principal_id,
      isAdmin: isAdmin,
      agents: agents,
      absencesPromise: absencesPromise,
    }
  } catch (err) {
    throw handleLoaderError(err)
  }
}

const ActionSchema = z.discriminatedUnion("intent", [
  ScheduleAbsenceSchema.extend({ intent: z.literal("create_absence") }),
  UpdateAbsenceSchema.extend({ intent: z.literal("update_absence") }),
  DeleteAbsenceSchema.extend({ intent: z.literal("delete_absence") }),
])

export async function action({ request }: Route.ActionArgs) {
  try {
    const session = await getSession(request)
    const formValues = await extractFormValuesFromRequest(request, ActionSchema)

    if (formValues.intent === "create_absence") {
      await scheduleAbsence(
        fdm,
        session.principal_id,
        formValues.agent_id,
        formValues.start_date,
        endOfDay(formValues.end_date),
        formValues.reason,
        formValues.note,
      )

      return dataWithSuccess("De afwezigheid is succesvol ingepland!", {
        message: "De afwezigheid is succesvol ingepland!",
      })
    }

    if (formValues.intent === "update_absence") {
      await updateAbsence(fdm, session.principal_id, formValues.absence_id, {
        start_date: formValues.start_date,
        end_date: endOfDay(formValues.end_date),
        reason: formValues.reason,
        note: formValues.note,
      })

      return dataWithSuccess("De afwezigheid is succesvol bijgewerkt!", {
        message: "De afwezigheid is succesvol bijgewerkt!",
      })
    }

    if (formValues.intent === "delete_absence") {
      await cancelAbsence(fdm, session.principal_id, formValues.absence_id)

      return dataWithSuccess("De afwezigheid is succesvol verwijderd!", {
        message: "De afwezigheid is succesvol verwijderd!",
      })
    }
  } catch (err) {
    // extractFormValuesFromRequest calls handleActionError itself, so if that is detected to be the case,
    // return the response returned from it directly.
    if (err instanceof Promise) {
      const awaited = await (err as Promise<any>).catch(() => {})
      if (awaited?.type === "DataWithResponseInit") {
        return awaited
      }
    }

    throw handleActionError(err)
  }
}

export default function SupportSettingsAbsences() {
  const { principal_id, isAdmin, agents, absencesPromise } = useLoaderData<typeof loader>()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAbsence, setSelectedAbsence] = useState<AbsenceCalendarItem | undefined>(undefined)
  const [defaultRange, setDefaultRange] = useState<{ start: Date; end: Date } | undefined>(
    undefined,
  )

  function openForCreate(range: { start: Date; end: Date }) {
    setSelectedAbsence(undefined)
    setDefaultRange(range)
    setDialogOpen(true)
  }

  function openForAbsence(absence: AbsenceCalendarItem) {
    setSelectedAbsence(absence)
    setDefaultRange(undefined)
    setDialogOpen(true)
  }

  return (
    <main className="p-6">
      <FarmTitle
        title="Afwezigheid"
        description={
          isAdmin
            ? "Bekijk en beheer de afwezigheid van alle medewerkers. Klik op 'Afwezigheid plannen' of sleep op de kalender om een periode te selecteren."
            : "Bekijk de afwezigheid van alle medewerkers en beheer je eigen afwezigheid. Klik op 'Afwezigheid plannen' of sleep op de kalender om een periode te selecteren."
        }
        rightNode={
          <Button
            onClick={() => openForCreate({ start: new Date(), end: new Date() })}
            className="gap-2"
          >
            <Plus className="size-4" />
            Afwezigheid plannen
          </Button>
        }
      />
      <Suspense
        fallback={
          <div className="flex h-180 items-center justify-center">
            <Spinner className="size-8" />
          </div>
        }
      >
        <Await resolve={absencesPromise}>
          {(absences) => (
            <AbsenceCalendar
              className="-mt-6"
              agent_id={principal_id}
              absences={absences.map((absence) => ({
                ...absence,
                start_date: new Date(absence.start_date),
                end_date: new Date(absence.end_date),
              }))}
              onSelectAbsence={openForAbsence}
              onSelectSlot={openForCreate}
            />
          )}
        </Await>
      </Suspense>
      <AbsenceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        absence={selectedAbsence}
        defaultRange={defaultRange}
        principal_id={principal_id}
        isAdmin={isAdmin}
        agents={agents}
      />
    </main>
  )
}
