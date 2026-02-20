import { Button, Heading, Link, Section, Text } from "@react-email/components"
import BaseEmailLayout from "./layout"

interface MagicLinkEmailProps {
    url: string
    code: string
    appName: string
    appBaseUrl: string
    senderName: string | undefined
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
    const previewText = `Link om aan te melden bij ${appName}`

    return (
        <BaseEmailLayout
            appName={appName}
            appBaseUrl={appBaseUrl}
            senderName={senderName}
            reasonText={`Je ontvangt deze e-mail omdat je een aanmeldcode hebt aangevraagd voor ${appName}.`}
            preview={previewText}
            footerText={
                <>
                    <Text className="text-muted text-[12px] leading-6">
                        Met vriendelijke groet, <br />
                        {senderName ? senderName : `Het ${appName} team`}
                    </Text>
                    <Link
                        href={appBaseUrl}
                        className="text-muted text-[12px] leading-6 mt-5 block text-center"
                    >
                        {appName}
                    </Link>
                    <Text className="text-muted text-[12px] leading-6 mt-1.25 block text-center">
                        {`Deze link is aangemaakt op ${emailTimestamp}`}
                    </Text>
                </>
            }
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
                Aanmelden bij {appName}
            </Heading>
            <Text className="text-black text-[14px] leading-6">Hallo,</Text>
            <Text className="text-black text-[14px] leading-6">
                U heeft een code aangevraagd om in te loggen bij {appName}.
            </Text>
            <Section className="bg-gray-100 rounded p-4 text-center my-6 border border-gray-200 dark:bg-slate-800 dark:border-slate-700">
                <Text className="m-0 text-gray-500 text-xs uppercase tracking-wider font-semibold dark:text-gray-400">
                    Uw inlogcode
                </Text>
                <Text className="m-0 text-black text-3xl font-bold tracking-[0.2em] py-2 dark:text-white">
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
                    href={url}
                    aria-label={`Aanmelden bij ${appName}`}
                    className="bg-primary text-white rounded px-5 py-3 text-[14px] font-semibold no-underline min-w-[200px]"
                >
                    Aanmelden bij {appName}
                </Button>
            </Section>
            <Text className="text-[#666666] text-[12px] leading-6 mt-1.25 block text-center mb-8">
                Deze code en link zijn éénmalig en voor 15 minuten geldig.
            </Text>
            <Text className="text-black text-[14px] leading-6">
                Indien u dit niet heeft aangevraagd, kunt u deze e-mail negeren.
            </Text>
        </BaseEmailLayout>
    )
}

export default MagicLinkEmail
