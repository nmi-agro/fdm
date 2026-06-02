import { Button, Heading, Section, Text } from "react-email"
import BaseEmailLayout from "./layout"

interface HelpdeskNewMessageEmailProps {
    ticketRef: string
    ticketSubject: string | null
    senderName: string
    messageBody: string
    ticketUrl: string
    recipientName: string
    appName: string
    appBaseUrl: string
    emailSenderName?: string
    logoFileName?: string
}

export function HelpdeskNewMessageEmail({
    ticketRef,
    ticketSubject,
    senderName,
    messageBody,
    ticketUrl,
    recipientName,
    appName,
    appBaseUrl,
    emailSenderName,
    logoFileName = "/fdm-high-resolution-logo-transparent-no-text.png",
}: HelpdeskNewMessageEmailProps) {
    const subject = ticketSubject ?? ticketRef
    const previewText = `${senderName} heeft een nieuw bericht geplaatst op ticket ${ticketRef}.`

    return (
        <BaseEmailLayout
            appName={appName}
            appBaseUrl={appBaseUrl}
            senderName={emailSenderName}
            logoFileName={logoFileName}
            reasonText={`Je ontvangt deze e-mail omdat er een nieuw bericht is geplaatst op ticket ${ticketRef} in ${appName}.`}
            preview={previewText}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
                Nieuw bericht op <b>{ticketRef}</b>
            </Heading>
            <Text className="text-black text-[14px] leading-6">
                Hallo {recipientName},
            </Text>
            <Text className="text-black text-[14px] leading-6">
                <b>{senderName}</b> heeft een nieuw bericht geplaatst op ticket{" "}
                <b>{subject}</b>.
            </Text>
            <Section className="bg-gray-100 rounded p-4 my-6 border border-gray-200">
                <Text className="m-0 text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2">
                    Bericht
                </Text>
                <Text className="m-0 text-black text-[14px]">
                    {messageBody
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/\"/g, "&quot;")
                        .replace(/'/g, "&#39;")
                        .split("\n")
                        // biome-ignore lint/suspicious/noArrayIndexKey: messageBody is constant for the lifetime of the component
                        .flatMap((line, i) => [line, <br key={i} />])}
                </Text>
            </Section>
            <Section className="mt-8 mb-2 text-center">
                <Button
                    href={ticketUrl}
                    className="bg-primary text-white border-solid border-primary border-2 rounded mx-6 px-5 py-3 text-[14px] font-semibold no-underline min-w-37.5"
                >
                    Bekijk ticket
                </Button>
            </Section>
        </BaseEmailLayout>
    )
}
