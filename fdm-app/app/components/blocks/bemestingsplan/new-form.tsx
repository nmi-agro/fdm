import { useState } from "react"
import { useFetcher } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import { Button } from "~/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { getCalendarSelection } from "~/lib/calendar"

export function NewBemestingsplanForm() {
  const years = getCalendarSelection()
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== "idle"
  const calendar = useCalendarStore((store) => store.calendar)
  // We consider the bemestingsplan table to be not specific to the current calendar year in the store.
  const [year, setYear] = useState<string>(calendar ?? String(new Date().getFullYear()))

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="establish_plan" />
      <div className="flex items-center justify-end gap-4">
        <Select name="year" value={year} onValueChange={setYear}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Selecteer een jaar" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={isSubmitting}>
          Opstellen{isSubmitting && <Spinner />}
        </Button>
      </div>
    </fetcher.Form>
  )
}
