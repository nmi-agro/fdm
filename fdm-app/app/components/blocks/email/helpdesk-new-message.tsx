import { Button, Heading, Link, Section, Text } from "react-email"
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

const MESSAGE_PREVIEW_LIMIT = 600

/**
 * Truncate a plain-text message on a word boundary for use in a notification email.
 * Returns the (possibly shortened) text and whether truncation occurred.
 */
function truncateMessage(body: string, limit: number) {
  const normalized = body.replace(/\r\n/g, "\n").trim()
  if (normalized.length <= limit) {
    return { text: normalized, truncated: false }
  }
  const slice = normalized.slice(0, limit)
  const lastSpace = slice.lastIndexOf(" ")
  const cut = lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice
  return { text: `${cut.trimEnd()}…`, truncated: true }
}

/** Render plain-text lines with <br/> between lines only (no trailing break). */
function renderLines(text: string) {
  return text.split("\n").map((line, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: text is constant for the lifetime of the component
    <span key={index}>
      {index > 0 && <br />}
      {line}
    </span>
  ))
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
  const previewText = `${senderName} heeft gereageerd op ticket ${ticketRef}.`
  const { text: shownMessage, truncated } = truncateMessage(messageBody, MESSAGE_PREVIEW_LIMIT)

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
        Nieuw bericht op je ticket
      </Heading>
      <Text className="text-black text-[14px] leading-6">Hallo {recipientName},</Text>
      <Text className="text-black text-[14px] leading-6">
        <b>{senderName}</b> heeft gereageerd op je ticket. Hieronder lees je het bericht.
      </Text>

      <Section className="bg-gray-100 rounded p-4 my-6 border border-gray-200">
        <table border={0} cellPadding="0" cellSpacing="0" role="presentation" className="w-full">
          <tr>
            <td className="text-gray-500 text-[12px] leading-6 align-top pr-3 w-20">Ticket</td>
            <td className="text-black text-[12px] leading-6 align-top font-mono">{ticketRef}</td>
          </tr>
          {ticketSubject && (
            <tr>
              <td className="text-gray-500 text-[12px] leading-6 align-top pr-3 w-20">Onderwerp</td>
              <td className="text-black text-[12px] leading-6 align-top font-semibold">
                {ticketSubject}
              </td>
            </tr>
          )}
        </table>
      </Section>

      <Section className="bg-white rounded p-4 my-6 border border-gray-200">
        <Text className="m-0 text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2">
          Bericht van {senderName}
        </Text>
        <Text className="m-0 text-black text-[14px] leading-6">{renderLines(shownMessage)}</Text>
        {truncated && (
          <Text className="m-0 mt-3 text-gray-500 text-[12px] leading-5">
            Dit bericht is ingekort.{" "}
            <Link href={ticketUrl} className="text-primary underline">
              Open het ticket
            </Link>{" "}
            om het volledige bericht te lezen.
          </Text>
        )}
      </Section>

      <Section className="mt-8 mb-2 text-center">
        <Button
          href={ticketUrl}
          className="bg-primary text-white border-solid border-primary border-2 rounded mx-6 px-5 py-3 text-[14px] font-semibold no-underline min-w-37.5"
        >
          Bekijk en reageer op ticket
        </Button>
      </Section>
      <Section className="mb-6 text-center">
        <Text className="text-muted text-[12px] leading-5">
          Werkt de knop niet? Open dan deze link:
          <br />
          <Link href={ticketUrl} className="text-muted underline">
            {ticketUrl}
          </Link>
        </Text>
      </Section>

      <Text className="text-muted text-[12px] leading-5">
        Reageren doe je in {appName} door het ticket te openen. Het is helaas nog niet mogelijk om
        direct via e-mail te reageren.
      </Text>
    </BaseEmailLayout>
  )
}
