import { and, eq, gte, inArray, lte } from "drizzle-orm"
import { checkPermission } from "./authorization"
import type { PrincipalId } from "./authorization.types"
import * as schema from "./db/schema"
import { handleError } from "./error"
import type { FdmType } from "./fdm.types"
import { createId } from "./id"
import type { OrganicCertification } from "./organic.types"

/**
 * Regular expression for validating EU TRACES document numbers for Organic Operator Certificates.
 * Examples: NL-BIO-01.528-0002967.2025.001, NL-BIO-01.528-0005471.2025.001
 */
const TRACES_REGEX = /^NL-BIO-\d{2}\.\d{3}-\d{7}\.\d{4}\.\d{3}$/

/**
 * Regular expression for validating SKAL numbers.
 * Examples: 026281, 024295
 */
const SKAL_REGEX = /^\d{6}$/

/**
 * Validates an EU TRACES document number.
 * @param tracesNumber The TRACES document number to validate.
 * @returns True if the TRACES number is valid, false otherwise.
 */
export function isValidTracesNumber(tracesNumber: string): boolean {
    return TRACES_REGEX.test(tracesNumber)
}

/**
 * Validates a SKAL number.
 * @param skalNumber The SKAL number to validate.
 * @returns True if the SKAL number is valid, false otherwise.
 */
export function isValidSkalNumber(skalNumber: string): boolean {
    return SKAL_REGEX.test(skalNumber)
}

/**
 * Adds a new organic certification for a specific farm.
 *
 * This function checks if the principal has 'write' permission on the farm,
 * then creates a new organic certification and links it to the farm.
 * It also validates the TRACES and SKAL numbers, and the issue/expiry dates.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The identifier of the principal creating the certification.
 * @param b_id_farm The identifier of the farm receiving the certification.
 * @param b_organic_traces The document number according to the EU Traces database.
 * @param b_organic_skal The SKAL number.
 * @param b_organic_issued The timestamp the certificate is valid from.
 * @param b_organic_expires The timestamp the certificate expires.
 * @returns The unique identifier for the new organic certification.
 * @throws {Error} If the principal does not have permission, validation fails, or the database transaction fails.
 */
export async function addOrganicCertification(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
    b_organic_traces: schema.organicCertificationsTypeInsert["b_organic_traces"],
    b_organic_skal: schema.organicCertificationsTypeInsert["b_organic_skal"],
    b_organic_issued: schema.organicCertificationsTypeInsert["b_organic_issued"],
    b_organic_expires: schema.organicCertificationsTypeInsert["b_organic_expires"],
): Promise<schema.organicCertificationsTypeInsert["b_id_organic"]> {
    if (b_organic_traces && !isValidTracesNumber(b_organic_traces)) {
        throw new Error("Invalid TRACES document number format.")
    }
    if (b_organic_skal && !isValidSkalNumber(b_organic_skal)) {
        throw new Error("Invalid SKAL number format.")
    }
    if (
        b_organic_issued &&
        b_organic_expires &&
        b_organic_issued.getTime() >= b_organic_expires.getTime()
    ) {
        throw new Error("Issue date must be before expiry date.")
    }

    try {
        return await fdm.transaction(async (tx) => {
            await checkPermission(
                tx,
                "farm",
                "write",
                b_id_farm,
                principal_id,
                "addOrganicCertification",
            )

            const existingCertification = await tx
                .select({ id: schema.organicCertifications.b_id_organic })
                .from(schema.organicCertifications)
                .leftJoin(
                    schema.organicCertificationsHolding,
                    eq(
                        schema.organicCertifications.b_id_organic,
                        schema.organicCertificationsHolding.b_id_organic,
                    ),
                )
                .where(
                    and(
                        eq(
                            schema.organicCertificationsHolding.b_id_farm,
                            b_id_farm,
                        ),
                        b_organic_traces
                            ? eq(
                                  schema.organicCertifications.b_organic_traces,
                                  b_organic_traces,
                              )
                            : undefined,
                        b_organic_skal
                            ? eq(
                                  schema.organicCertifications.b_organic_skal,
                                  b_organic_skal,
                              )
                            : undefined,
                    ),
                )
                .limit(1)

            if (existingCertification.length > 0) {
                throw new Error(
                    "Organic certification with similar TRACES/SKAL number already exists for this farm.",
                )
            }

            const b_id_organic = createId()
            await tx.insert(schema.organicCertifications).values({
                b_id_organic,
                b_organic_traces,
                b_organic_skal,
                b_organic_issued,
                b_organic_expires,
            })

            await tx.insert(schema.organicCertificationsHolding).values({
                b_id_farm,
                b_id_organic,
            })

            return b_id_organic
        })
    } catch (err) {
        throw handleError(err, "Exception for addOrganicCertification", {
            b_id_farm,
            b_organic_traces,
            b_organic_skal,
        })
    }
}

/**
 * Removes an organic certification.
 *
 * This function checks if the principal has 'write' permission on the associated farm,
 * then deletes the certification and its link to the farm.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The identifier of the principal removing the certification.
 * @param b_id_organic The identifier of the organic certification to remove.
 * @throws {Error} If the principal does not have permission, the certification does not exist, or the database transaction fails.
 */
export async function removeOrganicCertification(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_organic: schema.organicCertificationsTypeInsert["b_id_organic"],
): Promise<void> {
    try {
        await fdm.transaction(async (tx) => {
            const holding = await tx
                .select()
                .from(schema.organicCertificationsHolding)
                .where(
                    eq(
                        schema.organicCertificationsHolding.b_id_organic,
                        b_id_organic,
                    ),
                )

            if (!holding[0]) {
                throw new Error("Organic certification not found on any farm.")
            }

            await checkPermission(
                tx,
                "farm",
                "write",
                holding[0].b_id_farm,
                principal_id,
                "removeOrganicCertification",
            )

            await tx
                .delete(schema.organicCertificationsHolding)
                .where(
                    eq(
                        schema.organicCertificationsHolding.b_id_organic,
                        b_id_organic,
                    ),
                )

            await tx
                .delete(schema.organicCertifications)
                .where(
                    eq(schema.organicCertifications.b_id_organic, b_id_organic),
                )
        })
    } catch (err) {
        throw handleError(err, "Exception for removeOrganicCertification", {
            b_id_organic,
        })
    }
}

/**
 * Lists all organic certifications for a given farm.
 *
 * This function checks if the principal has 'read' permission on the farm before returning the list.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The identifier of the principal requesting the list.
 * @param b_id_farm The identifier of the farm.
 * @returns A Promise that resolves with a list of organic certifications for the specified farm.
 * @throws {Error} If the principal does not have permission to read the farm's certifications.
 */
export async function listOrganicCertifications(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
): Promise<OrganicCertification[]> {
    try {
        return await fdm.transaction(async (tx) => {
            await checkPermission(
                tx,
                "farm",
                "read",
                b_id_farm,
                principal_id,
                "listOrganicCertifications",
            )

            const holdings = await tx
                .select({
                    b_id_organic:
                        schema.organicCertificationsHolding.b_id_organic,
                })
                .from(schema.organicCertificationsHolding)
                .where(
                    eq(
                        schema.organicCertificationsHolding.b_id_farm,
                        b_id_farm,
                    ),
                )

            if (holdings.length === 0) {
                return []
            }

            const organicIds = holdings.map(
                (holding: { b_id_organic: string }) => holding.b_id_organic,
            )

            return await tx
                .select()
                .from(schema.organicCertifications)
                .where(
                    inArray(
                        schema.organicCertifications.b_id_organic,
                        organicIds,
                    ),
                )
        })
    } catch (err) {
        throw handleError(err, "Exception for listOrganicCertifications", {
            b_id_farm,
        })
    }
}

/**
 * Retrieves the details of a single organic certification by its ID.
 *
 * This function checks if the principal has 'read' permission on the associated farm
 * before returning the certification details.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The identifier of the principal requesting the certification.
 * @param b_id_organic The identifier of the organic certification to retrieve.
 * @returns A Promise that resolves with the organic certification details, or undefined if not found.
 * @throws {Error} If the principal does not have permission or the database transaction fails.
 */
export async function getOrganicCertification(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_organic: schema.organicCertificationsTypeSelect["b_id_organic"],
): Promise<OrganicCertification | undefined> {
    try {
        return await fdm.transaction(async (tx) => {
            const holding = await tx
                .select({
                    b_id_farm: schema.organicCertificationsHolding.b_id_farm,
                })
                .from(schema.organicCertificationsHolding)
                .where(
                    eq(
                        schema.organicCertificationsHolding.b_id_organic,
                        b_id_organic,
                    ),
                )
                .limit(1)

            if (!holding[0]) {
                return undefined // Certification not linked to any farm or does not exist
            }

            await checkPermission(
                tx,
                "farm",
                "read",
                holding[0].b_id_farm,
                principal_id,
                "getOrganicCertification",
            )

            const certification = await tx
                .select()
                .from(schema.organicCertifications)
                .where(
                    eq(schema.organicCertifications.b_id_organic, b_id_organic),
                )
                .limit(1)

            return certification[0]
        })
    } catch (err) {
        throw handleError(err, "Exception for getOrganicCertification", {
            b_id_organic,
        })
    }
}

/**
 * Checks if a farm has a valid organic certification on a specific date.
 *
 * This function checks if the principal has 'read' permission on the farm.
 * A certification is considered valid if the given date falls within its issued and expires dates.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The identifier of the principal making the request.
 * @param b_id_farm The identifier of the farm.
 * @param date The date to check for a valid certification.
 * @returns A Promise that resolves to true if a valid organic certification is found, false otherwise.
 * @throws {Error} If the principal does not have permission to read the farm's certifications.
 */
export async function isOrganicCertificationValid(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
    date: Date,
): Promise<boolean> {
    try {
        return await fdm.transaction(async (tx) => {
            await checkPermission(
                tx,
                "farm",
                "read",
                b_id_farm,
                principal_id,
                "isOrganicCertificationValid",
            )

            const result = await tx
                .select({ id: schema.organicCertifications.b_id_organic })
                .from(schema.organicCertifications)
                .leftJoin(
                    schema.organicCertificationsHolding,
                    eq(
                        schema.organicCertifications.b_id_organic,
                        schema.organicCertificationsHolding.b_id_organic,
                    ),
                )
                .where(
                    and(
                        eq(
                            schema.organicCertificationsHolding.b_id_farm,
                            b_id_farm,
                        ),
                        lte(
                            schema.organicCertifications.b_organic_issued,
                            date,
                        ),
                        gte(
                            schema.organicCertifications.b_organic_expires,
                            date,
                        ),
                    ),
                )
                .limit(1)

            return result.length > 0
        })
    } catch (err) {
        throw handleError(err, "Exception for isOrganicCertificationValid", {
            b_id_farm,
            date,
        })
    }
}
