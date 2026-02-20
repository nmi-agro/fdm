import {
    Body,
    Button,
    Container,
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

interface FarmInvitationEmailProps {
    farmName: string
    inviterName: string
    targetEmail: string
    role: string
    appName: string
    appBaseUrl?: string
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
    appBaseUrl = "",
    logoFileName = "/fdm-high-resolution-logo-transparent.png",
    isUnregistered = false,
}: FarmInvitationEmailProps) => {
    const logoPath = `${appBaseUrl}${logoFileName}`
    const roleLabel = roleLabels[role] ?? role
    const fontFamily = `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif`

    return (
        <Html lang="nl">
            <Head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
                <style>{`
                * {
                    font-family: ${fontFamily};
                }
            `}</style>
            </Head>
            <Preview>
                {`${inviterName} heeft je uitgenodigd voor toegang tot bedrijf ${farmName} in ${appName}.`}
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
                            Uitnodiging voor bedrijfstoegang
                        </Heading>
                        <Text className="text-black text-[14px] leading-6">
                            Hallo {targetEmail},
                        </Text>
                        <Text className="text-black text-[14px] leading-6">
                            {inviterName} heeft je uitgenodigd om toegang te
                            krijgen tot het bedrijf <b>{farmName}</b> in{" "}
                            {appName} met de rol <b>{roleLabel}</b>.
                        </Text>
                        {isUnregistered ? (
                            <>
                                <Text className="text-black text-[14px] leading-6">
                                    Maak een account aan om de uitnodiging te
                                    accepteren. Na registratie en verificatie
                                    van je e-mailadres wordt je toegang
                                    automatisch verleend.
                                </Text>
                                <Section className="mt-8 mb-2 text-center">
                                    <Button
                                        href={`${appBaseUrl}/signin`}
                                        className="bg-[#0070f3] text-white border-solid border-[#0070f3] border-2 rounded mx-6 px-3 py-3 text-[14px] font-semibold no-underline"
                                    >
                                        Account aanmaken
                                    </Button>
                                </Section>
                            </>
                        ) : (
                            <>
                                <Text className="text-black text-[14px] leading-6">
                                    Log in en accepteer of weiger de uitnodiging
                                    via je dashboard.
                                </Text>
                                <Section className="mt-8 mb-2 text-center">
                                    <Button
                                        href={`${appBaseUrl}/farm`}
                                        className="bg-[#0070f3] text-white border-solid border-[#0070f3] border-2 rounded mx-6 px-3 py-3 text-[14px] font-semibold no-underline"
                                    >
                                        Bekijk uitnodiging
                                    </Button>
                                </Section>
                                <Section className="mt-4 mb-8 text-center">
                                    <Link href={`${appBaseUrl}/farm`}>
                                        of open je dashboard
                                    </Link>
                                </Section>
                            </>
                        )}
                        <Text className="text-black text-[14px] leading-6">
                            Als je deze uitnodiging niet wilt accepteren, kun je
                            deze e-mail negeren.
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
