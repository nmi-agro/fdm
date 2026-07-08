import { Button, Heading, Hr, Section, Text } from "react-email"
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
  logoFileName = "/fdm-high-resolution-logo-transparent-no-text.png",
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
      <Heading className="mx-0 my-7.5 p-0 text-center text-[24px] font-normal text-black">
        Welkom bij {appName}, {name}! 👋
      </Heading>
      <Section className="mx-0 my-5 p-0">
        <Text className="text-[14px] leading-6 text-black">
          Fijn dat je er bent. Met {appName} heb je een handige tool in handen om beter agronomisch
          inzicht te krijgen. We helpen je graag op weg met de nieuwste mogelijkheden.
        </Text>
      </Section>

      <Hr className="mx-0 my-6 w-full border border-solid border-[#eaeaea]" />

      <Section>
        <Heading as="h2" className="mx-0 my-7.5 p-0 text-center text-[20px] font-normal text-black">
          Ontdek de mogelijkheden
        </Heading>

        <Text className="text-[16px] leading-6 font-bold text-black">
          De Atlas: Alles in kaart gebracht
        </Text>
        <Text className="text-[14px] leading-6 text-black">
          Verken agrarisch Nederland met de interactieve Atlas. Schakel tussen de beschikbare
          kaartlagen voor maximaal inzicht:
        </Text>
        <table border={0} cellPadding="0" cellSpacing="0" role="presentation" className="w-full">
          <tr>
            <td className="w-6 pr-2 pl-4 align-top text-[14px] leading-6 text-black" valign="top">
              &bull;
            </td>
            <td className="align-top text-[14px] leading-6 text-black" valign="top">
              <b>Gewasrotatie</b>: Zie de percelen op de kaart en klik op een perceel om de
              gewashistorie tot 2009 terug te bekijken. Zie ook in welke gebieden het valt voor de
              gebruiksruimte en de potentie voor koolstofopslag.
            </td>
          </tr>
          <tr>
            <td
              className="w-6 pt-2 pr-2 pl-4 align-top text-[14px] leading-6 text-black"
              valign="top"
            >
              &bull;
            </td>
            <td className="pt-2 align-top text-[14px] leading-6 text-black" valign="top">
              <b>Hoogtekaart (AHN4)</b>: Analyseer het microreliëf van percelen tot in detail.
            </td>
          </tr>
          <tr>
            <td
              className="w-6 pt-2 pr-2 pl-4 align-top text-[14px] leading-6 text-black"
              valign="top"
            >
              &bull;
            </td>
            <td className="pt-2 align-top text-[14px] leading-6 text-black" valign="top">
              <b>Bodemkaart</b>: Raadpleeg de BRO-bodemkaart voor inzicht in bodemtype en
              samenstelling.
            </td>
          </tr>
        </table>

        <Text className="mt-6 text-[16px] leading-6 font-bold text-black">
          Balansen en bemesting
        </Text>
        <Text className="text-[14px] leading-6 text-black">
          {appName} ondersteunt doelsturing met concrete tools:
        </Text>
        <table border={0} cellPadding="0" cellSpacing="0" role="presentation" className="w-full">
          <tr>
            <td className="w-6 pr-2 pl-4 align-top text-[14px] leading-6 text-black" valign="top">
              &bull;
            </td>
            <td className="align-top text-[14px] leading-6 text-black" valign="top">
              <b>Stikstofbalans</b>: Monitor de aan- en afvoer van stikstof en zie hoe efficiënt uw
              stikstofgebruik is (bodemoverschot).
            </td>
          </tr>
          <tr>
            <td
              className="w-6 pt-2 pr-2 pl-4 align-top text-[14px] leading-6 text-black"
              valign="top"
            >
              &bull;
            </td>
            <td className="pt-2 align-top text-[14px] leading-6 text-black" valign="top">
              <b>Organische stofbalans</b>: Krijg inzicht in de opbouw en afbraak van organische
              stof voor een gezonde bodem op lange termijn.
            </td>
          </tr>
          <tr>
            <td
              className="w-6 pt-2 pr-2 pl-4 align-top text-[14px] leading-6 text-black"
              valign="top"
            >
              &bull;
            </td>
            <td className="pt-2 align-top text-[14px] leading-6 text-black" valign="top">
              <b>Bemestingsplan</b>: Maak een compleet plan inclusief gebruiksruimte en download
              deze als PDF.
            </td>
          </tr>
        </table>

        <Text className="mt-6 text-[16px] leading-6 font-bold text-black">Samenwerken</Text>
        <Text className="text-[14px] leading-6 text-black">
          Nodig je adviseur of medewerkers uit om mee te kijken in uw bedrijf. Jij bepaalt wie
          toegang heeft en welke rechten zij krijgen.
        </Text>
      </Section>

      <Section className="mt-8 mb-8 text-center">
        <Button
          className="bg-primary min-w-50 rounded px-5 py-3 text-[14px] font-semibold text-white no-underline"
          href={absoluteUrl}
        >
          Start met {appName}
        </Button>
      </Section>

      <Section className="mx-0 my-5 p-0">
        <Text className="text-[14px] leading-6 text-black">
          Heb je vragen of suggesties? We helpen je graag. Je kunt ons bereiken door te reageren op
          deze mail.
        </Text>
      </Section>
      <Hr className="mx-0 my-6 w-full border border-solid border-[#eaeaea]" />
    </BaseEmailLayout>
  )
}
