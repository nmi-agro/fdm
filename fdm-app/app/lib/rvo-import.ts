import type { Field } from "@nmi-agro/fdm-core"
import {
  type ImportReviewAction,
  RvoImportReviewStatus,
  type RvoImportReviewItem,
  type UserChoiceMap,
} from "@nmi-agro/fdm-rvo/types"
import { getItemId } from "@nmi-agro/fdm-rvo/utils"

/**
 * The default action for each RVO import review item, keyed by item id.
 */
export function defaultChoices(items: RvoImportReviewItem<Field>[]): UserChoiceMap {
  const choices: UserChoiceMap = {}
  for (const item of items) {
    const id = getItemId(item)
    let defaultAction: ImportReviewAction

    switch (item.status) {
      case RvoImportReviewStatus.NEW_REMOTE:
        defaultAction = "ADD_REMOTE"
        break
      case RvoImportReviewStatus.NEW_LOCAL:
        defaultAction = "REMOVE_LOCAL"
        break
      case RvoImportReviewStatus.EXPIRED_LOCAL:
        defaultAction = "CLOSE_LOCAL"
        break
      case RvoImportReviewStatus.CONFLICT:
        defaultAction = "UPDATE_FROM_REMOTE"
        break
      case RvoImportReviewStatus.MATCH:
        defaultAction = "NO_ACTION"
        break
    }
    choices[id] = defaultAction
  }
  return choices
}
