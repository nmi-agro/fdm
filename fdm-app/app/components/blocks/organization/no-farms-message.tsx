import { NavLink } from "react-router"
import { buttonVariants } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"

export function NoFarmsMessage({ action }: { action?: { label: string; to: string } }) {
  return (
    <Empty className="border-none">
      <EmptyHeader>
        <EmptyTitle>
          Het lijkt erop dat je organisatie geen toegang heeft tot bedrijven. :(
        </EmptyTitle>
        <EmptyDescription>
          Neem contact op met bedrijven om toegang tot hen te krijgen.
        </EmptyDescription>
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <NavLink to={action.to} className={buttonVariants({})} data-slot="button">
            {action.label}
          </NavLink>
        </EmptyContent>
      )}
    </Empty>
  )
}
