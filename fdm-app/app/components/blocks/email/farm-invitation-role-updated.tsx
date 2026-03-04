import { Button, Heading, Section, Text } from "@react-email/components"
import BaseEmailLayout from "./layout"

interface FarmInvitationRoleUpdatedEmailProps {
    farmName: string
    inviterName: string
    targetEmail: string
    newRole: string
    appName: string
    appBaseUrl: string
    senderName?: string
    logoFileName?: string
}

const roleLabels: Record<string, string> = {
    owner: "Eigenaar",
    advisor: "Adviseur",
    researcher: "Onderzoeker",
}

export const FarmInvitationRoleUpdatedEmail = ({
    farmName,
    inviterName,
    targetEmail,
    newRole,
    appName,
    appBaseUrl,
    senderName,
    logoFileName = "/fdm-high-resolution-logo-transparent.png",
}: FarmInvitationRoleUpdatedEmailProps) => {
    const roleLabel = roleLabels[newRole] ?? newRole
    const previewText = `Je uitnodiging voor ${farmName} is bijgewerkt. Je nieuwe rol is ${roleLabel}.`

    return (
        <BaseEmailLayout
            appName={appName}
            appBaseUrl={appBaseUrl}
            senderName={senderName}
            logoFileName={logoFileName}
            reasonText={`Je ontvangt deze e-mail omdat ${inviterName} je uitnodiging voor bedrijf ${farmName} heeft bijgewerkt.`}
            preview={previewText}
            showFooter={false}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
                Uitnodiging voor <b>{farmName}</b> bijgewerkt
            </Heading>
            <Text className="text-black text-[14px] leading-6">
                Hallo {targetEmail},
            </Text>
            <Text className="text-black text-[14px] leading-6">
                {inviterName} heeft je uitnodiging voor toegang tot het bedrijf{" "}
                <b>{farmName}</b> in {appName} bijgewerkt. Je nieuwe rol is{" "}
                <b>{roleLabel}</b>.
            </Text>
            <Text className="text-black text-[14px] leading-6">
                Log in om de uitnodiging te accepteren of te weigeren.
            </Text>
            <Section className="mt-8 mb-2 text-center">
                <Button
                    href={`${appBaseUrl}/farm`}
                    className="bg-primary text-white border-solid border-primary border-2 rounded mx-6 px-5 py-3 text-[14px] font-semibold no-underline min-w-37.5"
                >
                    Bekijk uitnodiging
                </Button>
            </Section>
        </BaseEmailLayout>
    )
}
