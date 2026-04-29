import { Button, Heading, Section, Text } from "react-email"
import BaseEmailLayout from "./layout"

interface MagicLinkEmailProps {
    url: string
    code: string
    appName: string
    appBaseUrl: string
    senderName?: string
    emailTimestamp: string
}

export const MagicLinkEmail = ({
    url,
    code,
    appName,
    appBaseUrl,
    senderName,
    emailTimestamp,
}: MagicLinkEmailProps) => {
    const previewText = "Gebruik de code of link om in te loggen."
    const absoluteUrl = url.startsWith("http") ? url : `https://${url}`

    return (
        <BaseEmailLayout
            appName={appName}
            appBaseUrl={appBaseUrl}
            senderName={senderName}
            reasonText={`Je ontvangt deze e-mail omdat je een aanmeldcode hebt aangevraagd voor ${appName}.`}
            preview={previewText}
            emailTimestamp={emailTimestamp}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
                Aanmelden bij {appName}
            </Heading>
            <Text className="text-black text-[14px] leading-6">Hallo,</Text>
            <Text className="text-black text-[14px] leading-6">
                Gebruik onderstaande code om veilig in te loggen bij {appName}.
            </Text>
            <Section className="bg-gray-100 rounded p-4 text-center my-6 border border-gray-200">
                <Text className="m-0 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                    Uw inlogcode
                </Text>
                <Text className="m-0 text-black text-3xl font-bold tracking-[0.2em] py-2">
                    {code.length === 8
                        ? `${code.slice(0, 4)}-${code.slice(4)}`
                        : code}
                </Text>
            </Section>
            <Text className="text-black text-[14px] leading-6">
                Kopieer de code hierboven of klik op de knop hieronder om direct
                verder te gaan:
            </Text>
            <Section className="mt-8 mb-8 text-center">
                <Button
                    href={absoluteUrl}
                    aria-label={`Aanmelden bij ${appName}`}
                    className="bg-primary text-white rounded px-5 py-3 text-[14px] font-semibold no-underline min-w-50"
                >
                    Aanmelden bij {appName}
                </Button>
            </Section>
            <Text className="text-muted text-[12px] leading-6 mt-1.5 block text-center mb-8">
                Deze code en link zijn éénmalig en voor 15 minuten geldig.
            </Text>
            <Text className="text-black text-[14px] leading-6">
                Indien je dit niet hebt aangevraagd, kun je deze e-mail negeren.
            </Text>
        </BaseEmailLayout>
    )
}

export default MagicLinkEmail
