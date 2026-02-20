import { Button, Heading, Hr, Section, Text } from "@react-email/components"
import BaseEmailLayout from "./layout"

interface WelcomeEmailProps {
    name: string
    url: string
    appName: string
    appBaseUrl?: string // Optional base URL for logo path
    senderName?: string // Optional sender name for footer
    logoFileName?: string // Optional logo file name
}

export function WelcomeEmail({
    name,
    url,
    appName,
    appBaseUrl = "",
    senderName,
    logoFileName = "/fdm-high-resolution-logo-transparent.png",
}: WelcomeEmailProps) {
    const previewText = `Ga aan de slag met je bedrijfsdata en ontdek de mogelijkheden.`
    const absoluteUrl = url.startsWith("http") ? url : `https://${url}`

    return (
        <BaseEmailLayout
            appName={appName}
            appBaseUrl={appBaseUrl}
            senderName={senderName}
            logoFileName={logoFileName}
            reasonText={`Je ontvangt deze e-mail omdat je een account hebt aangemaakt bij ${appName}.`}
            preview={previewText}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
                Welkom bij {appName}, {name}! 👋
            </Heading>
            <Section className="my-5 mx-0 p-0">
                <Text className="text-black text-[14px] leading-6">
                    Bedankt voor je aanmelding. Dit is een overzicht van de
                    belangrijkste functies.
                </Text>
            </Section>

            <Hr className="border border-solid border-[#eaeaea] my-6.5 mx-0 w-full" />

            <Section>
                <Heading
                    as="h2"
                    className="text-black text-[20px] font-normal text-center p-0 my-7.5 mx-0"
                >
                    Wat kun je nu doen?
                </Heading>
                <Text className="text-black text-[16px] font-bold leading-6">
                    1. Een bedrijf aanmaken
                </Text>
                <Text className="text-black text-[14px] leading-6">
                    Door een bedrijf aan te maken, krijg je toegang tot de
                    volgende functies:
                </Text>
                <ul className="text-black text-[14px] leading-6 ml-4 list-disc pl-5">
                    <li>
                        Stikstofbalans, bemestingsadvies en gebruiksruimte-apps.
                    </li>
                    <li>
                        Beheer van meerdere jaren voor een compleet overzicht.
                    </li>
                    <li>
                        Een uitgebreide lijst van meststoffen die je zelf kunt
                        aanpassen.
                    </li>
                    <li>De mogelijkheid om je adviseur toegang te geven.</li>
                </ul>

                <Text className="text-black text-[16px] font-bold leading-6 mt-6">
                    2. De Atlas verkennen
                </Text>
                <Text className="text-black text-[14px] leading-6">
                    Je kunt er ook voor kiezen om de Atlas te verkennen. Hier
                    vind je onder andere:
                </Text>
                <ul className="text-black text-[14px] leading-6 ml-4 list-disc pl-5">
                    <li>De volledige gewashistorie van percelen sinds 2009.</li>
                    <li>
                        Bekijk het microreliëf van percelen met de hoogtekaart.
                    </li>
                    <li>
                        Of een perceel in een gebied met beperkingen voor de
                        gebruiksruimte valt.
                    </li>
                    <li>
                        Een inschatting van de bodemtextuur en het
                        grondwaterpeil.
                    </li>
                </ul>
            </Section>

            <Section className="text-center mt-8 mb-8">
                <Button
                    className="bg-primary rounded text-white text-[14px] font-semibold no-underline px-5 py-3 min-w-[200px]"
                    href={absoluteUrl}
                >
                    Start met {appName}
                </Button>
            </Section>
            <Section className="my-5 mx-0 p-0">
                <Text className="text-black text-[14px] leading-6">
                    Heb je vragen of suggesties? We horen graag van je. Je kunt
                    ons ook bereiken door te reageren op deze mail.
                </Text>
            </Section>
            <Hr className="border border-solid border-[#eaeaea] my-6.5 mx-0 w-full" />
        </BaseEmailLayout>
    )
}
