import { Button, Heading, Hr, Link, Section, Text } from "react-email"
import { getHelpHref } from "~/lib/manual/help-targets"
import BaseEmailLayout from "./layout"

interface WelcomeEmailProps {
  name: string
  url: string
  appName: string
  appBaseUrl?: string // Optional base URL for logo path
  senderName?: string // Optional sender name for footer
  logoFileName?: string // Optional logo file name
}

const textClassName = "text-[14px] leading-6 text-black"

/** One numbered step of the "Zo begint u" list. */
function Step({ number, title, children }: { number: number; title: string; children: string }) {
  return (
    <tr>
      <td className="w-6 pt-2 pr-2 align-top text-[14px] leading-6 text-black" valign="top">
        {number}.
      </td>
      <td className="pt-2 align-top text-[14px] leading-6 text-black" valign="top">
        <b>{title}</b> {children}
      </td>
    </tr>
  )
}

/**
 * E-mail sent once, when an account is created: says what the app offers and how to start.
 * Addresses the reader formally (u), like the sign-in page it follows.
 */
export function WelcomeEmail({
  name,
  url,
  appName,
  appBaseUrl = "",
  senderName,
  logoFileName = "/fdm-high-resolution-logo-transparent-no-text.png",
}: WelcomeEmailProps) {
  "use no memo"
  const previewText = "Maak uw eerste bedrijf aan en haal uw percelen op bij RVO."
  const absoluteUrl = url.startsWith("http") ? url : `https://${url}`
  const manualUrl = `${absoluteUrl.replace(/\/$/, "")}${getHelpHref("aan-de-slag")}`

  return (
    <BaseEmailLayout
      appName={appName}
      appBaseUrl={appBaseUrl}
      senderName={senderName}
      logoFileName={logoFileName}
      reasonText={`U ontvangt deze e-mail omdat u een account heeft aangemaakt bij ${appName}.`}
      preview={previewText}
    >
      <Heading className="mx-0 my-7.5 p-0 text-center text-[24px] font-normal text-black">
        Welkom bij {appName}, {name}
      </Heading>
      <Section className="mx-0 my-5 p-0">
        <Text className={textClassName}>
          Fijn dat u er bent. {appName} geeft inzicht in bodem, nutriënten en emissies op uw
          percelen: de stikstof- en organische-stofbalans, de gebruiksruimte, het bemestingsadvies
          en de bodemkwaliteit, in samenhang.
        </Text>
      </Section>

      <Hr className="mx-0 my-6 w-full border border-solid border-[#eaeaea]" />

      <Section>
        <Heading as="h2" className="mx-0 my-5 p-0 text-[18px] font-semibold text-black">
          Zo begint u
        </Heading>
        <table border={0} cellPadding="0" cellSpacing="0" role="presentation" className="w-full">
          <Step number={1} title="Maak uw bedrijf aan.">
            Haal uw percelen op bij RVO, met eHerkenning of een shapefile. De percelen komen erin te
            staan met het gewas.
          </Step>
          <Step number={2} title="Upload uw bodemanalyses.">
            {`U kunt meerdere pdf's tegelijk uploaden; ${appName} leest ze uit en u controleert de waarden. Zonder analyse rekent ${appName} met bodemwaarden die het NMI schat.`}
          </Step>
          <Step number={3} title="Vul bemesting en oogst aan.">
            Die voert u zelf in. Dat kost wat tijd, maar u kunt een bemesting of oogst voor meerdere
            percelen tegelijk vastleggen. Wilt u een afgelopen seizoen narekenen, houd dan uw
            bemestingsplan en oogstgegevens bij de hand.
          </Step>
        </table>
        <Text className={`mt-4 ${textClassName}`}>
          Daarna ziet u de balansen, de gebruiksruimte, het bemestingsadvies en de bodemindicatoren
          voor uw bedrijf. Hoe completer uw gegevens, hoe meer de berekeningen zeggen.
        </Text>
      </Section>

      <Section className="mt-8 mb-4 text-center">
        <Button
          className="bg-primary min-w-50 rounded px-5 py-3 text-[14px] font-semibold text-white no-underline"
          href={absoluteUrl}
        >
          Naar {appName}
        </Button>
      </Section>
      <Section className="mb-8 text-center">
        <Link href={manualUrl} className="text-[14px] text-black underline">
          Aan de slag in de handleiding
        </Link>
      </Section>

      <Section className="mx-0 my-5 p-0">
        <Heading as="h2" className="mx-0 my-3 p-0 text-[18px] font-semibold text-black">
          Samenwerken
        </Heading>
        <Text className={textClassName}>
          Werkt u met een adviseur? Nodig die uit met het e-mailadres en bepaal zelf welke rechten
          die krijgt. Werkt een adviesbureau of studieclub al in {appName}, dan geeft u de hele
          organisatie in één keer toegang door op de naam te zoeken.
        </Text>
        <Text className={textClassName}>
          Werkt u zelf met meerdere mensen aan meerdere bedrijven? Maak dan een organisatie aan.
          Leden zien dan samen de bedrijven waar de organisatie toegang toe heeft, met overzichten
          van de balansen, de bodemindicatoren en de maatregelen over al die bedrijven.
        </Text>
        <Text className={textClassName}>
          Vragen of suggesties? Reageer op deze e-mail; we helpen u graag.
        </Text>
      </Section>
      <Hr className="mx-0 my-6 w-full border border-solid border-[#eaeaea]" />
    </BaseEmailLayout>
  )
}
