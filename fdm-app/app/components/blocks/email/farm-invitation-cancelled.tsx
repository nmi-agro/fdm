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
  logoFileName = "/fdm-high-resolution-logo-transparent-no-text.png",
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
      <Heading className="mx-0 my-7.5 p-0 text-center text-[24px] font-normal text-black">
        Uitnodiging voor <b>{farmName}</b> ingetrokken
      </Heading>
      <Text className="text-[14px] leading-6 text-black">Hallo {targetEmail},</Text>
      <Text className="text-[14px] leading-6 text-black">
        {inviterName} heeft je uitnodiging voor toegang tot het bedrijf <b>{farmName}</b> in{" "}
        {appName} ingetrokken.
      </Text>
      <Text className="text-[14px] leading-6 text-black">
        Als je denkt dat dit een vergissing is, neem dan contact op met {inviterName}.
      </Text>
    </BaseEmailLayout>
  )
}
