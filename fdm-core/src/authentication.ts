import type { GoogleOptions, MicrosoftOptions, User } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { betterAuth } from "better-auth/minimal"
import { magicLink, organization, username } from "better-auth/plugins"
import { eq } from "drizzle-orm"
import { customAlphabet } from "nanoid"
import { generateFromEmail } from "unique-username-generator"
import * as authNSchema from "./db/schema-authn"
import { handleError } from "./error"
import type { FdmType } from "./fdm"
import { autoAcceptInvitationsForNewUser } from "./invitation"

export type BetterAuth = FdmAuth

/**
 * Initializes and configures the authentication system for the FDM application using Better Auth.
 *
 * This function sets up the Better Auth system with a PostgreSQL database adapter and a custom schema,
 * allowing users to authenticate via social providers like Google and Microsoft, or optionally with email and password.
 * It configures additional user fields (firstname, surname, lang, farm_active), and manages session parameters
 * with a 30-day expiration and daily update. It also defines mappings from social provider profiles to user
 * formats, extracting relevant user information.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param google Optional configuration for Google authentication. If provided, users can sign up and sign in with their Google accounts.
 * @param microsoft Optional configuration for Microsoft authentication. If provided, users can sign up and sign in with their Microsoft accounts.
 * @param sendMagicLinkEmail Optional function to send magic link emails. If provided, the magic link plugin will use this function to send emails.
 * @param emailAndPassword Optional boolean indicating whether to enable email and password authentication. Defaults to false.
 * @param sendWelcomeEmail Optional function to send welcome emails. If provided, after an user is created, this function will be called to send a welcome email to them.
 * @returns The configured authentication instance.
 * @throws {Error} If required environment variables are missing or if role assignment fails.
 */
export function createFdmAuth(
    fdm: FdmType,
    google?: { clientSecret: string; clientId: string },
    microsoft?: { clientSecret: string; clientId: string },
    sendMagicLinkEmail?: (
        email: string,
        url: string,
        code: string,
    ) => Promise<void>,
    emailAndPassword?: boolean,
    sendWelcomeEmail?: (user: User) => Promise<void>,
) {
    // Setup social auth providers
    let googleAuth: GoogleOptions | undefined
    if (google) {
        googleAuth = {
            clientId: google?.clientId,
            clientSecret: google?.clientSecret,
            mapProfileToUser: async (profile: {
                name: string
                email: string
                picture: string
                given_name: string
                family_name: string
            }) => {
                return {
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture,
                    firstname: profile.given_name,
                    surname: profile.family_name,
                    username: await createUsername(fdm, profile.email),
                    displayUsername: createDisplayUsername(
                        profile.given_name,
                        profile.family_name,
                    ),
                }
            },
        }
    }

    let microsoftAuth: MicrosoftOptions | undefined
    if (microsoft) {
        microsoftAuth = {
            clientId: microsoft.clientId,
            clientSecret: microsoft.clientSecret,
            tenantId: "common",
            mapProfileToUser: async (profile: {
                name: string | undefined
                email: string
                picture: string
            }) => {
                const { firstname, surname } = splitFullName(profile.name)
                return {
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture,
                    firstname: firstname,
                    surname: surname,
                    username: await createUsername(fdm, profile.email),
                    displayUsername: createDisplayUsername(firstname, surname),
                }
            },
        }
    }

    const auth = betterAuth({
        database: drizzleAdapter(fdm, {
            provider: "pg",
            schema: authNSchema,
        }),
        user: {
            additionalFields: {
                firstname: {
                    type: "string",
                    required: false,
                    defaultValue: null,
                },
                surname: {
                    type: "string",
                    required: false,
                    defaultValue: null,
                },
                lang: {
                    type: "string",
                    required: true,
                    defaultValue: "nl-NL",
                },
                farm_active: {
                    type: "string",
                    required: false,
                    defaultValue: null,
                },
            },
        },
        session: {
            expiresIn: 60 * 60 * 24 * 30, // 30 days
            updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
        },
        socialProviders: {
            google: googleAuth,
            microsoft: microsoftAuth,
        },
        rateLimit: {
            enabled: process.env.NODE_ENV === "production",
            window: 10,
            max: 100,
            storage: "database",
            customRules: {
                "/magic-link/verify": {
                    window: 60 * 15, // 15 minutes
                    max: 5,
                },
            },
        },
        emailAndPassword: {
            enabled: emailAndPassword || false,
        },
        plugins: [
            username(),
            organization({
                organizationHooks: {
                    beforeCreateOrganization: async ({ organization }) => {
                        return {
                            data: {
                                ...organization,
                                metadata: {
                                    isVerified: false,
                                    description: "",
                                    ...(organization.metadata || {}),
                                },
                            },
                        }
                    },
                },
                allowUserToCreateOrganization: true,
            }),
            magicLink({
                expiresIn: 60 * 15,
                generateToken: () => generateReadSafeOTP(),
                sendMagicLink: async (
                    { email, url, token },
                    _request,
                ): Promise<void> => {
                    if (sendMagicLinkEmail) {
                        await sendMagicLinkEmail(email, url, token)

                        // Set username if user is new
                        const user = await fdm
                            .select({
                                id: authNSchema.user.id,
                                username: authNSchema.user.username,
                                email: authNSchema.user.email,
                            })
                            .from(authNSchema.user)
                            .where(eq(authNSchema.user.email, email))
                            .limit(1)

                        if (user.length > 0 && !user[0].username) {
                            await fdm
                                .update(authNSchema.user)
                                .set({
                                    username: await createUsername(fdm, email),
                                })
                                .where(eq(authNSchema.user.id, user[0].id))
                        }
                    } else {
                        console.warn(
                            "sendMagicLinkEmail function not provided to createFdmAuth. Magic link emails will not be sent.",
                        )
                    }
                },
            }),
        ],
        databaseHooks: {
            user: {
                create: {
                    after: async (user) => {
                        // Check if username is created after signup, otherwise add an username (typically when signed up with magic link)
                        const userName = await fdm
                            .select({
                                username: authNSchema.user.username,
                            })
                            .from(authNSchema.user)
                            .where(eq(authNSchema.user.id, user.id))
                            .limit(1)

                        if (userName.length > 0 && !userName[0].username) {
                            await fdm
                                .update(authNSchema.user)
                                .set({
                                    username: await createUsername(
                                        fdm,
                                        user.email,
                                    ),
                                })
                                .where(eq(authNSchema.user.id, user.id))
                        }

                        // Auto-accept pending invitations if email is already verified (e.g. social login)
                        if (user.emailVerified) {
                            try {
                                await autoAcceptInvitationsForNewUser(
                                    fdm,
                                    user.email,
                                    user.id,
                                )
                            } catch (err) {
                                console.warn(
                                    "autoAcceptInvitationsForNewUser failed for user",
                                    user.id,
                                    err,
                                )
                            }
                        }

                        if (sendWelcomeEmail) await sendWelcomeEmail(user)
                    },
                },
                update: {
                    after: async (user) => {
                        // Auto-accept pending invitations when email becomes verified
                        if (user.emailVerified) {
                            try {
                                await autoAcceptInvitationsForNewUser(
                                    fdm,
                                    user.email,
                                    user.id,
                                )
                            } catch (err) {
                                console.warn(
                                    "autoAcceptInvitationsForNewUser failed for user",
                                    user.id,
                                    err,
                                )
                            }
                        }
                    },
                },
            },
        },
    })

    return auth
}

export type FdmAuth = ReturnType<typeof createFdmAuth>

/**
 * Updates the profile information of a user.
 *
 * This function allows updating the first name, surname, and language preference of a user. It constructs an object
 * containing only the fields that need to be updated and then performs the update operation. Additionally, it updates
 * the display username if either the first name or surname is being updated.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param user_id - The ID of the user to update.
 * @param firstname - (Optional) The new first name of the user.
 * @param surname - (Optional) The new surname of the user.
 * @param lang - (Optional) The new language preference of the user.
 * @returns A promise that resolves when the user's profile has been updated.
 * @throws {Error} Throws an error if any database operation fails.
 *
 */
export async function updateUserProfile(
    fdm: FdmType,
    user_id: string,
    firstname?: string,
    surname?: string,
    lang?: "nl-NL",
): Promise<void> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            const updatedFields: Partial<typeof authNSchema.user.$inferInsert> =
                {}
            if (firstname !== undefined) {
                updatedFields.firstname = firstname
            }
            if (surname !== undefined) {
                updatedFields.surname = surname
            }
            if (lang !== undefined) {
                updatedFields.lang = lang
            }

            // Update displayUsername if firstname or surname are updated
            if (firstname !== undefined || surname !== undefined) {
                const currentUser = await tx
                    .select({
                        firstname: authNSchema.user.firstname,
                        surname: authNSchema.user.surname,
                        username: authNSchema.user.username,
                    })
                    .from(authNSchema.user)
                    .where(eq(authNSchema.user.id, user_id))
                    .limit(1)

                if (currentUser.length > 0) {
                    const currentFirstname =
                        firstname !== undefined
                            ? firstname
                            : currentUser[0].firstname
                    const currentSurname =
                        surname !== undefined ? surname : currentUser[0].surname
                    updatedFields.displayUsername = createDisplayUsername(
                        currentFirstname,
                        currentSurname,
                    )

                    // Build `name` from non-null parts (or set to null if none)
                    const nameParts = [currentFirstname, currentSurname].filter(
                        (part) => part != null,
                    )
                    updatedFields.name =
                        nameParts.length > 0 ? nameParts.join(" ") : undefined
                }
            }

            if (Object.keys(updatedFields).length > 0) {
                await tx
                    .update(authNSchema.user)
                    .set(updatedFields)
                    .where(eq(authNSchema.user.id, user_id))
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for updateUserProfile", {
            user_id,
            firstname,
            surname,
            lang,
        })
    }
}

/**
 * Splits a full name into first name and surname, handling various formats including "LastName, FirstName".
 *
 * @param fullName - The full name string.
 * @returns An object containing the first name and surname.
 */
export function splitFullName(fullName: string | undefined): {
    firstname: string | null
    surname: string | null
} {
    if (!fullName || fullName.trim() === "") {
        return { firstname: null, surname: null }
    }

    const trimmedName = fullName.trim()
    // Check for "LastName, FirstName" format
    if (trimmedName.includes(",")) {
        const parts = trimmedName.split(",").map((part) => part.trim())
        if (parts.length === 2) {
            return { firstname: parts[1], surname: parts[0] }
        }
    }

    const names = trimmedName.split(/\s+/) // Split by one or more spaces

    if (names.length === 1) {
        // Only one name provided
        return { firstname: names[0], surname: null }
    }

    // Multiple names provided
    const firstname = names[0]
    const surname = names.slice(-1)[0] // Get the last name
    return { firstname, surname }
}

async function createUsername(fdm: FdmType, email: string): Promise<string> {
    const digits = 3

    // Create username from email
    let username = generateFromEmail(email, digits)

    // Check if username already exists
    const existingUser = await fdm
        .select({
            username: authNSchema.user.username,
        })
        .from(authNSchema.user)
        .where(eq(authNSchema.user.username, username))
        .limit(1)

    // If username exists, append random digits until we find a unique one
    if (existingUser && existingUser.length > 0) {
        while (existingUser) {
            username = generateFromEmail(email, digits)
            const checkUser = await fdm
                .select({
                    username: authNSchema.user.username,
                })
                .from(authNSchema.user)
                .where(eq(authNSchema.user.username, username))
                .limit(1)
            if (checkUser && checkUser.length === 0) break
        }
    }

    return username
}

export function createDisplayUsername(
    firstname: string | null | undefined,
    surname: string | null | undefined,
): string | null {
    // Filter out null or empty name parts and join with a space
    const nameParts = [firstname, surname].filter((part) => part?.trim())
    const name = nameParts.join(" ")

    // If no name is given return null
    if (!name || name.trim() === "") {
        return null
    }

    return name
}

const ALPHABET = "23456789ABCDFGHJKLMNPQRSTVWXYZ"
const generateCodeWithNanoId = customAlphabet(ALPHABET, 8)
/**
 * Generates a read-safe OTP (One-Time Password).
 *
 * This function uses a character set that avoids ambiguous characters
 * (e.g., I, O, 1, 0) to ensure the code is easy to read and type.
 * It produces an 8-character string.
 *
 * @returns {string} An 8-character read-safe OTP.
 */
function generateReadSafeOTP(): string {
    return generateCodeWithNanoId()
}
