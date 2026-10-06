import { ChevronDown } from "lucide-react"
import { FarmCard, type FarmWithRoles } from "~/components/blocks/farm/farm-card"
import { Badge } from "~/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"

/**
 * A farm group of an organization the user is a member of.
 */
export type FarmOverviewGroup = {
  b_id_group: string
  b_name_group: string
  b_id_organization: string
  b_id_farms: string[]
}

const gridClassName = "grid gap-6 px-4 pb-6 md:px-8 md:pb-8 lg:grid-cols-2 xl:grid-cols-3"

type Section = {
  id: string
  title: string
  subtitle?: string
  farms: FarmWithRoles[]
}

/**
 * Renders the farms of the organizations of the user, under collapsible group headers when the
 * farms are grouped. A farm in multiple groups is shown under each of them; farms without a group
 * are shown last under "Niet gegroepeerd".
 *
 * When none of the farms is in a group, the farms are rendered as a plain grid, so organizations
 * without groups see no difference.
 *
 * @param props.farms - The farms that belong to an organization of the user.
 * @param props.groups - The groups of the organizations of the user.
 * @param props.organizationNames - Names of the organizations by id, shown when groups of more
 *   than one organization are listed.
 * @returns A React node.
 */
export function GroupedFarmCards({
  farms,
  groups,
  organizationNames,
}: {
  farms: FarmWithRoles[]
  groups: FarmOverviewGroup[]
  organizationNames: Record<string, string>
}) {
  const sections: Section[] = []
  const groupedFarmIds = new Set<string>()

  for (const group of groups) {
    const members = farms.filter(
      (farm) =>
        farm.organization?.id === group.b_id_organization &&
        group.b_id_farms.includes(farm.b_id_farm),
    )
    if (members.length === 0) {
      continue
    }
    for (const farm of members) {
      groupedFarmIds.add(farm.b_id_farm)
    }
    sections.push({
      id: group.b_id_group,
      title: group.b_name_group,
      subtitle: organizationNames[group.b_id_organization],
      farms: members,
    })
  }

  if (sections.length === 0) {
    return (
      <div className={gridClassName}>
        {farms.map((farm) => (
          <FarmCard key={farm.b_id_farm} farm={farm} />
        ))}
      </div>
    )
  }

  sections.sort((a, b) => a.title.localeCompare(b.title, "nl"))
  const ungrouped = farms.filter((farm) => !groupedFarmIds.has(farm.b_id_farm))
  if (ungrouped.length > 0) {
    sections.push({ id: "ungrouped", title: "Niet gegroepeerd", farms: ungrouped })
  }

  // Only name the organization when the groups come from more than one
  const showOrganization = new Set(groups.map((group) => group.b_id_organization)).size > 1

  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <Collapsible key={section.id} defaultOpen>
          <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-2 text-left md:px-8">
            <ChevronDown
              aria-hidden="true"
              className="text-muted-foreground h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90"
            />
            <h3 className="font-semibold">{section.title}</h3>
            <Badge variant="secondary">{section.farms.length}</Badge>
            {showOrganization && section.subtitle && (
              <span className="text-muted-foreground text-sm">{section.subtitle}</span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={gridClassName}>
              {section.farms.map((farm) => (
                <FarmCard key={`${section.id}-${farm.b_id_farm}`} farm={farm} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}
