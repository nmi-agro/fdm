import { TZDate } from "@date-fns/tz"
import { render } from "@react-email/components"
import type { User } from "better-auth"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import postmark from "postmark"
import { FarmInvitationEmail } from "~/components/blocks/email/farm-invitation"
import { FarmInvitationCancelledEmail } from "~/components/blocks/email/farm-invitation-cancelled"
import { FarmInvitationRoleUpdatedEmail } from "~/components/blocks/email/farm-invitation-role-updated"
import { InvitationEmail } from "~/components/blocks/email/invitation"
import { MagicLinkEmail } from "~/components/blocks/email/magic-link"
import { WelcomeEmail } from "~/components/blocks/email/welcome"
import { serverConfig } from "~/lib/config.server"
import type { ExtendedUser } from "~/types/extended-user"

const client = new postmark.ServerClient(String(process.env.POSTMARK_API_KEY))

interface Email {
    From: string
    To: string
    Subject: string
    HtmlBody: string
    Tag: string
}

export async function renderWelcomeEmail(user: User): Promise<Email> {
    const emailHtml = await render(
        WelcomeEmail({
            name: user.name,
            url: serverConfig.url,
            appName: serverConfig.name,
            appBaseUrl: serverConfig.url,
            senderName: serverConfig.mail?.postmark.sender_name,
        }),
    )

    const email = {
        From: `"${serverConfig.mail?.postmark.sender_name}" <${serverConfig.mail?.postmark.sender_address}>`,
        To: user.email,
        Subject: `Welkom bij ${serverConfig.name}! Krijg inzicht in je bedrijfsdata.`,
        HtmlBody: emailHtml,
        Tag: "welcome",
    }

    return email
}

export async function renderInvitationEmail(
    inviteeEmail: string,
    inviter: ExtendedUser,
    organizationName: string,
    invitationId: string,
): Promise<Email> {
    const emailHtml = await render(
        InvitationEmail({
            inviteeEmail: inviteeEmail,
            inviterName: `${inviter.firstname} ${inviter.surname}`,
            invitationId: invitationId,
            organizationName: organizationName,
            appName: serverConfig.name,
            appBaseUrl: serverConfig.url,
            senderName: serverConfig.mail?.postmark.sender_name,
        }),
        { pretty: true },
    )

    const email: Email = {
        From: `"${serverConfig.mail?.postmark.sender_name}" <${serverConfig.mail?.postmark.sender_address}>`,
        To: inviteeEmail,
        Subject: `${inviter.firstname} ${inviter.surname} heeft je uitgenodigd om lid te worden van ${organizationName}!`,
        HtmlBody: emailHtml,
        Tag: "invitation-organization",
    }

    return email
}

export async function renderFarmInvitationEmail(
    targetEmail: string,
    inviterName: string,
    farmName: string,
    role: string,
    isUnregistered: boolean,
): Promise<Email> {
    const emailHtml = await render(
        FarmInvitationEmail({
            farmName,
            inviterName,
            targetEmail,
            role,
            appName: serverConfig.name,
            appBaseUrl: serverConfig.url,
            senderName: serverConfig.mail?.postmark.sender_name,
            isUnregistered,
        }),
        { pretty: true },
    )

    const subjectVerb = isUnregistered
        ? "nodigt je uit"
        : "heeft je uitgenodigd"
    const email: Email = {
        From: `"${serverConfig.mail?.postmark.sender_name}" <${serverConfig.mail?.postmark.sender_address}>`,
        To: targetEmail,
        Subject: `${inviterName} ${subjectVerb} voor toegang tot bedrijf ${farmName}`,
        HtmlBody: emailHtml,
        Tag: isUnregistered ? "invitation-farm-new-user" : "invitation-farm",
    }

    return email
}

export async function renderFarmInvitationCancelledEmail(
    targetEmail: string,
    inviterName: string,
    farmName: string,
): Promise<Email> {
    const emailHtml = await render(
        FarmInvitationCancelledEmail({
            farmName,
            inviterName,
            targetEmail,
            appName: serverConfig.name,
            appBaseUrl: serverConfig.url,
            senderName: serverConfig.mail?.postmark.sender_name,
        }),
        { pretty: true },
    )

    const email: Email = {
        From: `"${serverConfig.mail?.postmark.sender_name}" <${serverConfig.mail?.postmark.sender_address}>`,
        To: targetEmail,
        Subject: `Je uitnodiging voor bedrijf ${farmName} is ingetrokken`,
        HtmlBody: emailHtml,
        Tag: "invitation-farm-cancelled",
    }

    return email
}

export async function renderFarmInvitationRoleUpdatedEmail(
    targetEmail: string,
    inviterName: string,
    farmName: string,
    newRole: string,
): Promise<Email> {
    const emailHtml = await render(
        FarmInvitationRoleUpdatedEmail({
            farmName,
            inviterName,
            targetEmail,
            newRole,
            appName: serverConfig.name,
            appBaseUrl: serverConfig.url,
            senderName: serverConfig.mail?.postmark.sender_name,
        }),
        { pretty: true },
    )

    const email: Email = {
        From: `"${serverConfig.mail?.postmark.sender_name}" <${serverConfig.mail?.postmark.sender_address}>`,
        To: targetEmail,
        Subject: `Je uitnodiging voor bedrijf ${farmName} is bijgewerkt`,
        HtmlBody: emailHtml,
        Tag: "invitation-farm-role-updated",
    }

    return email
}

export async function renderMagicLinkEmail(
    emailAddress: string,
    magicLinkUrl: string,
    code: string,
): Promise<Email> {
    const timeZone = getTimeZoneFromUrl(magicLinkUrl)

    // Construct the frontend verification URL
    // We want to point to /signin/verify instead of the API endpoint
    // We preserve query parameters like callbackURL
    const parsedMagicLinkUrl = new URL(magicLinkUrl)
    const frontendUrl = new URL("/signin/verify", serverConfig.url)
    frontendUrl.searchParams.set("code", code)

    // Copy relevant search params (like callbackURL)
    parsedMagicLinkUrl.searchParams.forEach((value, key) => {
        if (key !== "token") {
            // We use 'code' instead of 'token'
            frontendUrl.searchParams.set(key, value)
        }
    })

    const finalUrl = frontendUrl.toString()

    // Show the local time only if available, otherwise show server time
    const emailTimestamp: string = format(
        timeZone ? TZDate.tz(timeZone) : new Date(),
        "Pp",
        { locale: nl },
    )

    const emailHtml = await render(
        MagicLinkEmail({
            url: finalUrl,
            code: code,
            appName: serverConfig.name,
            appBaseUrl: serverConfig.url,
            senderName: serverConfig.mail?.postmark.sender_name,
            emailTimestamp: emailTimestamp,
        }),
        { pretty: true },
    )

    const email: Email = {
        From: `"${serverConfig.mail?.postmark.sender_name}" <${serverConfig.mail?.postmark.sender_address}>`,
        To: emailAddress,
        Subject: `Aanmeldcode voor ${serverConfig.name} | ${emailTimestamp}`,
        HtmlBody: emailHtml,
        Tag: "magic-link",
    }

    return email
}

/**
 * Extracts and validates a timezone from a given URL's callbackURL parameter.
 * @param url The URL to parse.
 * @returns The validated timezone string or undefined if not found or invalid.
 */
function getTimeZoneFromUrl(url: string): string | undefined {
    try {
        const parsedMagicLinkUrl = new URL(url)
        const callbackUrlCandidate =
            parsedMagicLinkUrl.searchParams.get("callbackURL")

        if (!callbackUrlCandidate) {
            return undefined
        }

        // Use a dummy base URL for parsing if callbackUrlCandidate is relative
        const parsedCallbackUrl = new URL(
            callbackUrlCandidate,
            callbackUrlCandidate.startsWith("http")
                ? undefined
                : "http://example.com",
        )
        const timeZoneCandidate = parsedCallbackUrl.searchParams.get("timeZone")

        if (timeZoneCandidate) {
            // Validate the timezone
            Intl.DateTimeFormat(undefined, { timeZone: timeZoneCandidate })
            return timeZoneCandidate
        }
    } catch (error) {
        console.warn("Invalid timezone in callbackURL:", error)
    }
    return undefined
}

import fs from "node:fs/promises"
export async function sendEmail(email: Email): Promise<void> {
    // await client.sendEmail(email)
    await fs.writeFile("email.html", email.HtmlBody)
}

export function isInactiveRecipientError(e: any) {
    return e && (e as { code: number }).code === 406
}

// Helper function to send magic link emails, to be passed to fdm-core
export async function sendMagicLinkEmailToUser(
    emailAddress: string,
    magicLinkUrl: string,
    code: string,
): Promise<void> {
    const email = await renderMagicLinkEmail(emailAddress, magicLinkUrl, code)
    await sendEmail(email)
}

export async function sendWelcomeEmailToUser(user: User) {
    try {
        const email = await renderWelcomeEmail(user)
        await sendEmail(email)
    } catch (error) {
        console.error("Error sending welcome email:", error)
    }
}
