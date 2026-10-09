import type * as schema from "./db/schema"

/**
 * A period in which a farm is or was part of a group. The dates are chosen by the user: from
 * when and until when the farm is part of the group, not when the change was recorded.
 */
export interface FarmGroupMembership {
  b_id_farm: schema.farmGroupJoiningTypeSelect["b_id_farm"]
  /** The date from which the farm is part of the group. */
  b_group_joined: schema.farmGroupJoiningTypeSelect["b_group_joined"]
  /** The date until which the farm is part of the group, or `null` when there is no end date. */
  b_group_leaved: schema.farmGroupLeavingTypeSelect["b_group_leaved"] | null
}

/**
 * A group of farms within an organization.
 */
export interface FarmGroup {
  b_id_group: schema.farmGroupsTypeSelect["b_id_group"]
  b_id_organization: schema.farmGroupsTypeSelect["b_id_organization"]
  b_name_group: schema.farmGroupsTypeSelect["b_name_group"]
  /** Identifiers of the farms that are part of the group at this moment. */
  b_id_farms: schema.farmGroupJoiningTypeSelect["b_id_farm"][]
  /** Every period in which a farm is or was part of the group, ordered by start date. */
  memberships: FarmGroupMembership[]
  created: schema.farmGroupsTypeSelect["created"]
  updated: schema.farmGroupsTypeSelect["updated"]
}
