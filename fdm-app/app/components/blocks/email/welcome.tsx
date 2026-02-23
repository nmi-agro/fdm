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
    const previewText = "Ga aan de slag en krijg beter agronomisch inzicht."
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
                    Fijn dat je er bent. Met {appName} heb je een handige tool
                    in handen om beter agronomisch inzicht te krijgen. We helpen
                    je graag op weg met de nieuwste mogelijkheden.
                </Text>
            </Section>

            <Hr className="border border-solid border-[#eaeaea] my-6 mx-0 w-full" />

            <Section>
                <Heading
                    as="h2"
                    className="text-black text-[20px] font-normal text-center p-0 my-7.5 mx-0"
                >
                    Ontdek de mogelijkheden
                </Heading>

                <Text className="text-black text-[16px] font-bold leading-6">
                    De Atlas: Alles in kaart gebracht
                </Text>
                <Text className="text-black text-[14px] leading-6">
                    Verken agrarisch Nederland met de interactieve Atlas.
                    Schakel tussen de beschikbare kaartlagen voor maximaal
                    inzicht:
                </Text>
                <table
                    border={0}
                    cellPadding="0"
                    cellSpacing="0"
                    role="presentation"
                    className="w-full"
                >
                    <tr>
                        <td
                            className="text-black text-[14px] leading-6 align-top pl-4 pr-2 w-6"
                            valign="top"
                        >
                            &bull;
                        </td>
                        <td
                            className="text-black text-[14px] leading-6 align-top"
                            valign="top"
                        >
                            <b>Gewasrotatie</b>: Zie de percelen op de kaart en
                            klik op een perceel om de gewashistorie tot 2009
                            terug te bekijken. Zie ook in welke gebieden het
                            valt voor de gebruiksruimte en de potentie voor
                            koolstofopslag.
                        </td>
                    </tr>
                    <tr>
                        <td
                            className="text-black text-[14px] leading-6 align-top pl-4 pr-2 w-6 pt-2"
                            valign="top"
                        >
                            &bull;
                        </td>
                        <td
                            className="text-black text-[14px] leading-6 align-top pt-2"
                            valign="top"
                        >
                            <b>Hoogtekaart (AHN4)</b>: Analyseer het microreliëf
                            van percelen tot in detail.
                        </td>
                    </tr>
                    <tr>
                        <td
                            className="text-black text-[14px] leading-6 align-top pl-4 pr-2 w-6 pt-2"
                            valign="top"
                        >
                            &bull;
                        </td>
                        <td
                            className="text-black text-[14px] leading-6 align-top pt-2"
                            valign="top"
                        >
                            <b>Bodemkaart</b>: Raadpleeg de BRO-bodemkaart voor
                            inzicht in bodemtype en samenstelling.
                        </td>
                    </tr>
                </table>

                <Text className="text-black text-[16px] font-bold leading-6 mt-6">
                    Balansen en bemesting
                </Text>
                <Text className="text-black text-[14px] leading-6">
                    {appName} ondersteunt doelsturing met concrete tools:
                </Text>
                <table
                    border={0}
                    cellPadding="0"
                    cellSpacing="0"
                    role="presentation"
                    className="w-full"
                >
                    <tr>
                        <td
                            className="text-black text-[14px] leading-6 align-top pl-4 pr-2 w-6"
                            valign="top"
                        >
                            &bull;
                        </td>
                        <td
                            className="text-black text-[14px] leading-6 align-top"
                            valign="top"
                        >
                            <b>Stikstofbalans</b>: Monitor de aan- en afvoer van
                            stikstof en zie hoe efficiënt uw stikstofgebruik is
                            (bodemoverschot).
                        </td>
                    </tr>
                    <tr>
                        <td
                            className="text-black text-[14px] leading-6 align-top pl-4 pr-2 w-6 pt-2"
                            valign="top"
                        >
                            &bull;
                        </td>
                        <td
                            className="text-black text-[14px] leading-6 align-top pt-2"
                            valign="top"
                        >
                            <b>Organische stofbalans</b>: Krijg inzicht in de
                            opbouw en afbraak van organische stof voor een
                            gezonde bodem op lange termijn.
                        </td>
                    </tr>
                    <tr>
                        <td
                            className="text-black text-[14px] leading-6 align-top pl-4 pr-2 w-6 pt-2"
                            valign="top"
                        >
                            &bull;
                        </td>
                        <td
                            className="text-black text-[14px] leading-6 align-top pt-2"
                            valign="top"
                        >
                            <b>Bemestingsplan</b>: Maak een compleet plan
                            inclusief gebruiksruimte en download deze als PDF.
                        </td>
                    </tr>
                </table>

                <Text className="text-black text-[16px] font-bold leading-6 mt-6">
                    Samenwerken
                </Text>
                <Text className="text-black text-[14px] leading-6">
                    Nodig je adviseur of medewerkers uit om mee te kijken in uw
                    bedrijf. Jij bepaalt wie toegang heeft en welke rechten zij
                    krijgen.
                </Text>
            </Section>

            <Section className="text-center mt-8 mb-8">
                <Button
                    className="bg-primary rounded text-white text-[14px] font-semibold no-underline px-5 py-3 min-w-50"
                    href={absoluteUrl}
                >
                    Start met {appName}
                </Button>
            </Section>

            <Section className="my-5 mx-0 p-0">
                <Text className="text-black text-[14px] leading-6">
                    Heb je vragen of suggesties? We helpen je graag. Je kunt ons
                    bereiken door te reageren op deze mail.
                </Text>
            </Section>
            <Hr className="border border-solid border-[#eaeaea] my-6 mx-0 w-full" />
        </BaseEmailLayout>
    )
}
