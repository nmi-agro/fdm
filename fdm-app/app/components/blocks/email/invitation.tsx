import {
    Body,
    Button,
    Container,
    Font,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
} from "@react-email/components"
import { Tailwind } from "@react-email/tailwind"

interface InvitationEmailProps {
    organizationName: string
    inviterName: string
    inviteeEmail: string
    invitationId: string
    appName: string
    appBaseUrl?: string // Optional base URL for logo path
    logoFileName?: string // Optional logo file name
}

export const InvitationEmail = ({
    organizationName,
    inviterName,
    inviteeEmail,
    invitationId,
    appName,
    appBaseUrl = "",
    logoFileName = "/fdm-high-resolution-logo-transparent.png",
}: InvitationEmailProps) => {
    const logoPath = `${appBaseUrl}${logoFileName}`

    return (
        <Html lang="nl">
            <Head>
                <Font
                    fontFamily="Inter"
                    fallbackFontFamily="sans-serif"
                    fontWeight={400}
                    fontStyle="normal"
                />
            </Head>
            <Preview>
                {`${inviterName} heeft je uitgenodigd om lid te worden van ${organizationName} in ${appName}.`}
            </Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-10 mx-auto p-5 w-116.25">
                        <Section className="mt-7.5">
                            <Img
                                src={logoPath}
                                width="150"
                                alt={`${appName} Logo`}
                                className="my-0 mx-auto"
                            />
                        </Section>
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
                            Je bent uitgenodigd!
                        </Heading>
                        <Text className="text-black text-[14px] leading-6">
                            Hallo {inviteeEmail},
                        </Text>
                        <Text className="text-black text-[14px] leading-6">
                            {inviterName} heeft je uitgenodigd om lid te worden
                            van de organisatie <b>{organizationName}</b> in{" "}
                            {appName}.
                        </Text>
                        <Text className="text-black text-[14px] leading-6">
                            Met {appName} kun je op een eenvoudige manier de
                            nutriëntenbalans en organische stofbalans berekenen.
                            Het is ook mogelijk om te bekijken welke meststoffen
                            er geschikt zijn voor een perceel. Je kunt bedrijven
                            aanmaken en met andere gebruikers samenwerken.
                        </Text>
                        <Section className="mt-8 mb-2 text-center">
                            <Button
                                href={`${appBaseUrl}/organization/invitations/${invitationId}/respond?intent=accept`}
                                className="bg-[#0070f3] text-white border-solid border-[#0070f3] border-2 rounded mx-6 px-3 py-3 text-[14px] font-semibold no-underline"
                            >
                                Accepteren
                            </Button>
                            <Button
                                href={`${appBaseUrl}/organization/invitations/${invitationId}/respond?intent=reject`}
                                className="bg-[#f5f5f5] text-[#171717] border-solid border-[#171717] border-2 rounded mx-6 px-3 py-3 text-[14px] font-semibold no-underline"
                            >
                                Afwijzen
                            </Button>
                        </Section>
                        <Section className="mt-8 mb-8 text-center">
                            <Link
                                href={`${appBaseUrl}/organization/invitations`}
                            >
                                of bekijk je uitnodigingen
                            </Link>
                        </Section>
                        <Text className="text-black text-[14px] leading-6">
                            Als je deze uitnodiging niet wilt accepteren, kun je
                            deze e-mail negeren, of op bovenstaande knop klikken
                            om de uitnodiging te weigeren.
                        </Text>
                        <Text className="text-black text-[14px] leading-6 mt-8">
                            Met vriendelijke groet, <br /> Het {appName} team
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}
