import type * as schema from "./db/schema"

/**
 * A group of farms within an organization, including the farms that are currently a member.
 */
export interface FarmGroup {
  b_id_group: schema.farmGroupsTypeSelect["b_id_group"]
  b_id_organization: schema.farmGroupsTypeSelect["b_id_organization"]
  b_name_group: schema.farmGroupsTypeSelect["b_name_group"]
  /** Identifiers of the farms that currently belong to the group. */
  b_id_farms: schema.farmGroupJoiningTypeSelect["b_id_farm"][]
  created: schema.farmGroupsTypeSelect["created"]
  updated: schema.farmGroupsTypeSelect["updated"]
}
