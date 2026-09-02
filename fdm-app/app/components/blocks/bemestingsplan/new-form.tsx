import { useEffect, useState } from "react"
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
import { cn } from "~/lib/utils"

export function NewBemestingsplanForm({ className }: { className?: string }) {
  const years = getCalendarSelection()
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== "idle"
  const calendar = useCalendarStore((store) => store.calendar)
  const [year, setYear] = useState<string>(calendar ?? String(new Date().getFullYear()))

  useEffect(() => {
    if (calendar) {
      setYear(calendar)
    }
  }, [calendar])

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="establish_plan" />
      <div className={cn("flex items-center gap-2", className)}>
        <Select name="year" value={year} onValueChange={setYear}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Selecteer teeltjaar" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                Teeltjaar {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={isSubmitting}>
          Opstellen{isSubmitting && <Spinner className="ml-1.5 h-4 w-4" />}
        </Button>
      </div>
    </fetcher.Form>
  )
}
