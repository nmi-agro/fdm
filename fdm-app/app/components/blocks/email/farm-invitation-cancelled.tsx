import { Heading, Text } from "react-email"
import BaseEmailLayout from "./layout"

interface FarmInvitationCancelledEmailProps {
    farmName: string
    inviterName: string
    targetEmail: string
    appName: string
    appBaseUrl: string
    senderName?: string
    logoFileName?: string
}

export const FarmInvitationCancelledEmail = ({
    farmName,
    inviterName,
    targetEmail,
    appName,
    appBaseUrl,
    senderName,
    logoFileName = "/fdm-high-resolution-logo-transparent.png",
}: FarmInvitationCancelledEmailProps) => {
    const previewText = `Je uitnodiging voor ${farmName} is ingetrokken.`

    return (
        <BaseEmailLayout
            appName={appName}
            appBaseUrl={appBaseUrl}
            senderName={senderName}
            logoFileName={logoFileName}
            reasonText={`Je ontvangt deze e-mail omdat ${inviterName} je uitnodiging voor bedrijf ${farmName} heeft ingetrokken.`}
            preview={previewText}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
                Uitnodiging voor <b>{farmName}</b> ingetrokken
            </Heading>
            <Text className="text-black text-[14px] leading-6">
                Hallo {targetEmail},
            </Text>
            <Text className="text-black text-[14px] leading-6">
                {inviterName} heeft je uitnodiging voor toegang tot het bedrijf{" "}
                <b>{farmName}</b> in {appName} ingetrokken.
            </Text>
            <Text className="text-black text-[14px] leading-6">
                Als je denkt dat dit een vergissing is, neem dan contact op met{" "}
                {inviterName}.
            </Text>
        </BaseEmailLayout>
    )
}
