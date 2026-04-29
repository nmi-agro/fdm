/**
 * # @nmi-agro/fdm-rvo: RVO Field Synchronization Logic
 *
 * This package provides the core logic for synchronizing agricultural field data with the
 * RVO (Rijksdienst voor Ondernemend Nederland) webservices. It wraps the
 * `@nmi-agro/rvo-connector` to handle authentication and data fetching, and implements a
 * robust field comparison mechanism to detect new, missing, and conflicting field data
 * between local and RVO records.
 *
 * ## Features
 *
 * -   **RVO Authentication Flow**: Helpers for generating authorization URLs and exchanging
 *     authorization codes for access tokens using the `RvoClient`.
 * -   **Field Data Fetching**: Retrieves agricultural field data from RVO, with GeoJSON
 *     parsing and validation against `RvoFieldSchema`.
 * -   **Field RVO Import Review Engine**:
 *     -   Compares local FDM fields (`@nmi-agro/fdm-core`'s `Field` type) against RVO fields.
 *     -   Utilizes a two-tier matching strategy: ID-based matching followed by spatial
 *         (IoU) matching.
 *     -   Detects and categorizes fields as `MATCH`, `NEW_REMOTE` (in RVO but not local),
 *         `NEW_LOCAL` (in local but not RVO), or `CONFLICT` (different properties in both).
 *     -   Identifies specific differing properties (`b_name`, `b_geometry`, `b_start`, `b_end`)
 *         for conflicts, allowing granular resolution.
 * -   **Type Safety**: Fully typed for a seamless development experience.
 *
 * @packageDocumentation
 */

export * from "./auth"
export * from "./compare"
export * from "./data"
export * from "./process"
export * from "./shapefile"
export * from "./types"
export * from "./utils"
