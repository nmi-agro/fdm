import type * as React from "react"
import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email"

interface BaseEmailLayoutProps {
  appName: string
  appBaseUrl?: string
  senderName?: string
  logoFileName?: string
  preview: string
  children: React.ReactNode
  showLogo?: boolean
  showFooter?: boolean
  footerText?: React.ReactNode
  reasonText?: string // Why the user received this email
  lang?: string
  emailTimestamp?: string
}

const defaultTheme = {
  theme: {
    extend: {
      colors: {
        primary: "#1c7f27",
        secondary: "#eaeaea",
        text: "#000000",
        muted: "#666666",
        background: "#ffffff",
      },
      spacing: {
        "7.5": "1.875rem", // 30px
        "116.25": "29.0625rem", // 465px
      },
    },
  },
}

export const BaseEmailLayout = ({
  appName,
  appBaseUrl = "",
  senderName,
  logoFileName = "/fdm-high-resolution-logo-transparent-no-text.png",
  preview,
  children,
  showLogo = true,
  showFooter = true,
  footerText,
  reasonText,
  lang = "nl",
  emailTimestamp,
}: BaseEmailLayoutProps) => {
  const logoPath = appBaseUrl ? `${appBaseUrl}${logoFileName}` : logoFileName
  const privacyUrl = appBaseUrl ? `${appBaseUrl}/privacy` : undefined

  return (
    <Html lang={lang}>
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="sans-serif"
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Tailwind config={defaultTheme}>
        <Body className="bg-background mx-auto my-auto font-sans">
          <Container className="border-secondary mx-auto my-10 w-116.25 max-w-full rounded border border-solid p-5">
            {showLogo && appBaseUrl && (
              <Section className="mt-7.5 text-center">
                <Img src={logoPath} width="150" alt={`${appName} Logo`} className="mx-auto my-0" />
              </Section>
            )}

            {children}

            {showFooter && (
              <Section className="mt-8 mb-8 text-center">
                {footerText || (
                  <>
                    <Text className="text-muted text-[12px] leading-6">
                      Met vriendelijke groet, <br /> {getGreetingName(senderName, appName)}
                    </Text>
                    {appBaseUrl && (
                      <Link
                        href={appBaseUrl}
                        className="text-muted mt-5 block text-center text-[12px] leading-6"
                      >
                        {appName}
                      </Link>
                    )}
                    {emailTimestamp && (
                      <Text className="text-muted mt-1.5 block text-center text-[12px] leading-6">
                        {`Deze link is aangemaakt op ${emailTimestamp}`}
                      </Text>
                    )}
                  </>
                )}
              </Section>
            )}

            {(reasonText || privacyUrl) && (
              <Section className="border-secondary mt-8 border-t border-solid pt-4 text-center">
                {reasonText && (
                  <Text className="text-muted mb-2 text-[10px] leading-4">{reasonText}</Text>
                )}
                <Text className="text-muted text-[10px] leading-4">
                  {appName}
                  {privacyUrl && (
                    <>
                      {" • "}
                      <Link href={privacyUrl} className="text-muted underline">
                        Privacybeleid
                      </Link>
                    </>
                  )}
                </Text>
              </Section>
            )}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

const getGreetingName = (senderName: string | undefined | null, appName: string): string => {
  return senderName || `Het ${appName} team`
}

export default BaseEmailLayout
