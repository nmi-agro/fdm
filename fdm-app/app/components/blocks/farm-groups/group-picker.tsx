import { useSearchParams } from "react-router"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { hasSameIds, type OrganizationFarmGroup } from "~/lib/farm-groups"

const ALL_FARMS = "__all"

/**
 * Lets the user pick a farm group as a saved selection of farms.
 *
 * Choosing a group writes the ids of its member farms to the `farmIds` search parameter, which the
 * page loaders already use. Choosing "Alle bedrijven" removes the parameter. Because the URL only
 * holds farm ids, a group that is renamed or deleted afterwards does not change the selection.
 * Renders nothing when the organization has no groups.
 *
 * @param props.groups - The farm groups of the organization.
 * @returns A React node, or `null` when there are no groups.
 */
export function GroupPicker({ groups }: { groups: OrganizationFarmGroup[] }) {
  const [searchParams, setSearchParams] = useSearchParams()

  if (groups.length === 0) {
    return null
  }

  const selectedFarmIds = searchParams.get("farmIds")?.split(",").filter(Boolean)
  const selectedGroup = selectedFarmIds
    ? groups.find((group) => hasSameIds(group.b_id_farms, selectedFarmIds))
    : undefined
  const value = selectedFarmIds ? (selectedGroup?.b_id_group ?? "") : ALL_FARMS

  return (
    <Select
      value={value}
      onValueChange={(newValue) => {
        setSearchParams((previous) => {
          const next = new URLSearchParams(previous)
          const group = groups.find((g) => g.b_id_group === newValue)
          if (group && group.b_id_farms.length > 0) {
            next.set("farmIds", group.b_id_farms.join(","))
          } else {
            next.delete("farmIds")
          }
          return next
        })
      }}
    >
      <SelectTrigger className="w-48" aria-label="Kies een groep">
        <SelectValue placeholder="Kies een groep" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_FARMS}>Alle bedrijven</SelectItem>
        {groups.map((group) => (
          <SelectItem
            key={group.b_id_group}
            value={group.b_id_group}
            disabled={group.b_id_farms.length === 0}
          >
            {group.b_name_group} ({group.b_id_farms.length})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
