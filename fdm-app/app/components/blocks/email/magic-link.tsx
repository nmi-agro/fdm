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
  const formattedCode = code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code
  const previewText = `Gebruik ${formattedCode} om aan te melden bij ${appName}.`
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
      <Heading className="mx-0 my-7.5 p-0 text-center text-[24px] font-normal text-black">
        Aanmelden bij {appName}
      </Heading>
      <Text className="text-[14px] leading-6 text-black">Hallo,</Text>
      <Text className="text-[14px] leading-6 text-black">
        Gebruik onderstaande code om veilig in te loggen bij {appName}.
      </Text>
      <Section className="my-6 rounded border border-gray-200 bg-gray-100 p-4 text-center">
        <Text className="m-0 text-xs font-semibold tracking-wider text-gray-500 uppercase">
          Uw inlogcode
        </Text>
        <Text className="m-0 py-2 text-3xl font-bold tracking-[0.2em] text-black">
          {formattedCode}
        </Text>
      </Section>
      <Text className="text-[14px] leading-6 text-black">
        Kopieer de code hierboven of klik op de knop hieronder om direct verder te gaan:
      </Text>
      <Section className="mt-8 mb-8 text-center">
        <Button
          href={absoluteUrl}
          aria-label={`Aanmelden bij ${appName}`}
          className="bg-primary min-w-50 rounded px-5 py-3 text-[14px] font-semibold text-white no-underline"
        >
          Aanmelden bij {appName}
        </Button>
      </Section>
      <Text className="text-muted mt-1.5 mb-8 block text-center text-[12px] leading-6">
        Deze code en link zijn éénmalig en voor 15 minuten geldig.
      </Text>
      <Text className="text-[14px] leading-6 text-black">
        Indien je dit niet hebt aangevraagd, kun je deze e-mail negeren.
      </Text>
    </BaseEmailLayout>
  )
}

export default MagicLinkEmail
