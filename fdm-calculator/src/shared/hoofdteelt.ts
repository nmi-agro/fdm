/**
 * The hoofdteelt helpers are defined in `@nmi-agro/fdm-core`, so that fdm-core can use the same
 * legal definition of the main cultivation. They are re-exported here for the calculator modules.
 */
export type { CompleteHoofdteeltCultivation, CultivationForHoofdteelt } from "@nmi-agro/fdm-core"
export { findHoofdteelt, GROENE_BRAAK } from "@nmi-agro/fdm-core"
