import { Button, Heading, Link, Section, Text } from "@react-email/components"
import BaseEmailLayout from "./layout"

interface InvitationEmailProps {
    organizationName: string
    inviterName: string
    inviteeEmail: string
    invitationId: string
    appName: string
    appBaseUrl?: string // Optional base URL for logo path
    senderName?: string // Optional sender name for footer
    logoFileName?: string // Optional logo file name
}

export const InvitationEmail = ({
    organizationName,
    inviterName,
    inviteeEmail,
    invitationId,
    appName,
    appBaseUrl = "",
    senderName,
    logoFileName = "/fdm-high-resolution-logo-transparent.png",
}: InvitationEmailProps) => {
    const previewText = `${inviterName} heeft je uitgenodigd om lid te worden van ${organizationName} in ${appName}.`

    return (
        <BaseEmailLayout
            appName={appName}
            appBaseUrl={appBaseUrl}
            senderName={senderName}
            logoFileName={logoFileName}
            reasonText={`Je ontvangt deze e-mail omdat ${inviterName} je heeft uitgenodigd voor ${organizationName}.`}
            preview={previewText}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
                Je bent uitgenodigd!
            </Heading>
            <Text className="text-black text-[14px] leading-6">
                Hallo {inviteeEmail},
            </Text>
            <Text className="text-black text-[14px] leading-6">
                {inviterName} heeft je uitgenodigd om lid te worden van de
                organisatie <b>{organizationName}</b> in {appName}.
            </Text>
            <Text className="text-black text-[14px] leading-6">
                Met {appName} kun je op een eenvoudige manier de
                nutriëntenbalans en organische stofbalans berekenen. Het is ook
                mogelijk om te bekijken welke meststoffen er geschikt zijn voor
                een perceel. Je kunt bedrijven aanmaken en met andere gebruikers
                samenwerken.
            </Text>
            <Section className="mt-8 mb-2 text-center">
                <Button
                    href={`${appBaseUrl}/organization/invitations/${invitationId}/respond?intent=accept`}
                    className="bg-primary text-white border-solid border-primary border-2 rounded mx-6 px-5 py-3 text-[14px] font-semibold no-underline min-w-[150px]"
                >
                    Accepteren
                </Button>
                <Button
                    href={`${appBaseUrl}/organization/invitations/${invitationId}/respond?intent=reject`}
                    className="bg-[#f5f5f5] text-[#171717] border-solid border-[#171717] border-2 rounded mx-6 px-5 py-3 text-[14px] font-semibold no-underline min-w-[150px]"
                >
                    Afwijzen
                </Button>
            </Section>
            <Section className="mt-8 mb-8 text-center">
                <Link href={`${appBaseUrl}/organization/invitations`}>
                    of bekijk je uitnodigingen
                </Link>
            </Section>
            <Text className="text-black text-[14px] leading-6">
                Als je deze uitnodiging niet wilt accepteren, kun je deze e-mail
                negeren, of op bovenstaande knop klikken om de uitnodiging te
                weigeren.
            </Text>
        </BaseEmailLayout>
    )
}
