import { Button, Heading, Link, Section, Text } from "@react-email/components"
import BaseEmailLayout from "./layout"

interface FarmInvitationEmailProps {
    farmName: string
    inviterName: string
    targetEmail: string
    role: string
    appName: string
    appBaseUrl: string
    senderName?: string
    logoFileName?: string
    /** If true, renders a "create account" CTA for unregistered users */
    isUnregistered?: boolean
}

const roleLabels: Record<string, string> = {
    owner: "Eigenaar",
    advisor: "Adviseur",
    researcher: "Onderzoeker",
}

export const FarmInvitationEmail = ({
    farmName,
    inviterName,
    targetEmail,
    role,
    appName,
    appBaseUrl,
    senderName,
    logoFileName = "/fdm-high-resolution-logo-transparent.png",
    isUnregistered = false,
}: FarmInvitationEmailProps) => {
    const roleLabel = roleLabels[role] ?? role
    const previewText = `Je hebt toegang gekregen tot ${farmName}. Bekijk de details.`

    return (
        <BaseEmailLayout
            appName={appName}
            appBaseUrl={appBaseUrl}
            senderName={senderName}
            logoFileName={logoFileName}
            reasonText={`Je ontvangt deze e-mail omdat ${inviterName} je heeft uitgenodigd voor bedrijf ${farmName}.`}
            preview={previewText}
            showFooter={false}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
                Uitnodiging voor <b>{farmName}</b> in {appName}
            </Heading>
            <Text className="text-black text-[14px] leading-6">
                Hallo {targetEmail},
            </Text>
            <Text className="text-black text-[14px] leading-6">
                {inviterName} heeft je uitgenodigd om toegang te krijgen tot het
                bedrijf <b>{farmName}</b> in {appName} met de rol{" "}
                <b>{roleLabel}</b>.
            </Text>
            {isUnregistered ? (
                <>
                    <Text className="text-black text-[14px] leading-6">
                        Maak een account aan om de uitnodiging te accepteren. Na
                        registratie wordt je toegang automatisch verleend.
                    </Text>
                    <Section className="mt-8 mb-2 text-center">
                        <Button
                            href={`${appBaseUrl}/signin`}
                            className="bg-primary text-white border-solid border-primary border-2 rounded mx-6 px-5 py-3 text-[14px] font-semibold no-underline min-w-[150px]"
                        >
                            Account aanmaken
                        </Button>
                    </Section>
                </>
            ) : (
                <>
                    <Text className="text-black text-[14px] leading-6">
                        Log in en accepteer of weiger de uitnodiging.
                    </Text>
                    <Section className="mt-8 mb-2 text-center">
                        <Button
                            href={`${appBaseUrl}/farm`}
                            className="bg-primary text-white border-solid border-primary border-2 rounded mx-6 px-5 py-3 text-[14px] font-semibold no-underline min-w-[150px]"
                        >
                            Bekijk uitnodiging
                        </Button>
                    </Section>
                    <Section className="mt-4 mb-8 text-center">
                        <Link href={`${appBaseUrl}/farm`}>
                            of open {appName} om je uitnodigingen te bekijken.
                        </Link>
                    </Section>
                </>
            )}
            <Text className="text-black text-[14px] leading-6">
                Als je deze uitnodiging niet wilt accepteren, kun je deze e-mail
                negeren.
            </Text>
        </BaseEmailLayout>
    )
}
