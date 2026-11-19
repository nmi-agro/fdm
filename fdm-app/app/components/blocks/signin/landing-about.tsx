import { SiGithub } from "@icons-pack/react-simple-icons"
import { ArrowRight, ExternalLink } from "lucide-react"
import { Link } from "react-router"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { buttonVariants } from "~/components/ui/button"
import { clientConfig } from "~/lib/config"
import { getHelpHref } from "~/lib/manual/help-targets"
import { useCookieConsentStore } from "~/store/cookie-consent"
import { SignInLink } from "./landing-header"
import { LandingSection, SectionHeading } from "./landing-primitives"

const PROJECTS = [
  {
    title: "Pilot Maatwerkaanpak",
    text: "Met boeren, de agrarische sector, kennisinstellingen en overheden testen we hoe doelsturing in de praktijk werkt, met de stikstofbalans als basis.",
  },
  {
    title: "PPS BAAT",
    text: "Samen met Wageningen Plant Research maken we bemestingsadvies toegankelijker, met inzicht in zowel de geadviseerde gift als de milieu-impact.",
  },
  {
    title: "Open Bodem Index en BBWP",
    text: `Twee veelgebruikte methoden voor bodemgezondheid en maatregelen. Via de BLN-indicatoren zijn ze geïntegreerd in ${clientConfig.name}.`,
  },
]

const PARTNERS = ["ZLTO", "LTO Noord", "WUR", "LVVN", "NVWA", "RVO"]

/** Who makes the product, that it is open source, and the projects and partners behind it. */
export function LandingAbout() {
  return (
    <LandingSection id="over">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading
            label={`Over ${clientConfig.name}`}
            title="Open source, ontwikkeld door het NMI"
          >
            <p>
              {clientConfig.name} is een initiatief van het Nutriënten Management Instituut (NMI).{" "}
              {clientConfig.name} is open source: iedereen kan de code inzien en verbeteringen
              voorstellen. Veel van de rekenregels zijn dat ook, en hoe de berekeningen werken leest
              u in de handleiding.
            </p>
            <p>
              {clientConfig.name} is volop in ontwikkeling, maar nu al inzetbaar voor uw bedrijf. We
              verbeteren het op basis van uw feedback.
            </p>
          </SectionHeading>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://github.com/nmi-agro/fdm"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
              data-slot="button"
            >
              <SiGithub aria-hidden="true" />
              <span>Bekijk de code op GitHub</span>
            </a>
            <a
              href="https://www.nmi-agro.nl"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "ghost" })}
              data-slot="button"
            >
              <span>Over het NMI</span>
              <ExternalLink aria-hidden="true" />
            </a>
          </div>
        </div>
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Drie projecten komen hier samen</h3>
          <dl className="mt-4">
            {PROJECTS.map((project) => (
              <div key={project.title} className="border-t py-4">
                <dt className="font-semibold">{project.title}</dt>
                <dd className="text-muted-foreground mt-1 text-[0.9375rem] leading-relaxed">
                  {project.text}
                </dd>
              </div>
            ))}
          </dl>
          <div className="border-t pt-4">
            <h3 className="text-muted-foreground text-sm font-medium">Partners</h3>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-medium">
              {PARTNERS.map((partner) => (
                <li key={partner}>{partner}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </LandingSection>
  )
}

/** Closing call to action on the brand dark surface. */
export function LandingCallToAction() {
  return (
    <section className="bg-[#122023] py-16 text-white lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 lg:px-8">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
          Probeer het met uw eigen bedrijf
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/80">
          Gratis tijdens de pilot en zonder installatie. Uw percelen haalt u op met een RVO-import.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <SignInLink className={buttonVariants({ size: "lg", variant: "secondary" })}>
            <span>Aanmelden</span>
            <ArrowRight aria-hidden="true" />
          </SignInLink>
          <Link
            to="/manual"
            className={buttonVariants({
              size: "lg",
              variant: "ghost",
              className: "text-white hover:bg-white/10 hover:text-white",
            })}
            data-slot="button"
          >
            Eerst de handleiding lezen
          </Link>
        </div>
      </div>
    </section>
  )
}

/** Frequently asked questions as a flat, hairline-separated accordion. */
export function LandingFaq() {
  return (
    <LandingSection id="vragen">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <SectionHeading label="Veelgestelde vragen" title="Goed om te weten" />
        <Accordion className="w-full border-t">
          <AccordionItem value="kosten">
            <AccordionTrigger className="text-base font-medium">
              Wat kost het gebruik van {clientConfig.name}?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-[0.9375rem] leading-relaxed">
              {clientConfig.name} is een open-source initiatief en tijdens de pilotfase gratis te
              gebruiken. Ons doel is een toegankelijke standaard voor de sector.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="starten">
            <AccordionTrigger className="text-base font-medium">
              Wat heb ik nodig om te starten?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-[0.9375rem] leading-relaxed">
              Alleen een account. Hoe u zich aanmeldt, uw eerste bedrijf aanmaakt en uw percelen
              importeert, leest u in{" "}
              <Link
                to={getHelpHref("aan-de-slag")}
                className="text-foreground font-medium underline underline-offset-4"
              >
                Aan de slag
              </Link>{" "}
              in de handleiding.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="veilig">
            <AccordionTrigger className="text-base font-medium">
              Is mijn data veilig?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-[0.9375rem] leading-relaxed">
              Ja. Uw data wordt versleuteld opgeslagen en is alleen toegankelijk voor u. U bepaalt
              zelf of en met wie (bijvoorbeeld uw adviseur) u gegevens deelt.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="samenwerken">
            <AccordionTrigger className="text-base font-medium">
              Kan ik samenwerken met mijn adviseur?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-[0.9375rem] leading-relaxed">
              Zeker. U kunt uw adviseur of andere betrokkenen uitnodigen voor uw bedrijf. U bepaalt
              welke rechten zij krijgen.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="overheid">
            <AccordionTrigger className="text-base font-medium">
              Is {clientConfig.name} een officieel overheidsinstrument?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-[0.9375rem] leading-relaxed">
              Nee. {clientConfig.name} is door het NMI ontwikkeld als ondersteunend instrument voor
              de sector. We werken nauw samen met onze partners, maar het is een inzicht- en
              adviestool en niet bedoeld voor wettelijke aangifte.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="ondersteuning">
            <AccordionTrigger className="text-base font-medium">
              Waar kan ik terecht voor ondersteuning?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-[0.9375rem] leading-relaxed">
              Voor technische vragen of feedback neemt u contact op met het supportteam van het NMI.
              In de zijbalk van {clientConfig.name} staat ook een feedbackknop. We horen graag uw
              bevindingen.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </LandingSection>
  )
}

/** Footer of the public landing page. */
export function LandingFooter() {
  const openCookieSettings = useCookieConsentStore((state) => state.openCookieSettings)
  const linkClassName = "hover:text-foreground underline-offset-4 hover:underline"

  return (
    <footer className="bg-background border-t py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 md:flex-row md:items-start md:justify-between lg:px-8">
        <div className="max-w-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#122023]">
              <img className="size-6" src={clientConfig.logomark} alt="" />
            </span>
            <span className="font-semibold">{clientConfig.name}</span>
          </div>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Ontwikkeld door het{" "}
            <a
              href="https://www.nmi-agro.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              Nutriënten Management Instituut
            </a>
            . Gelicentieerd onder de MIT-licentie.
          </p>
        </div>
        <nav aria-label="Voettekst">
          <ul className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link to="/manual" className={linkClassName}>
                Handleiding
              </Link>
            </li>
            <li>
              <a
                href="https://github.com/nmi-agro/fdm"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClassName}
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClassName}
              >
                Privacybeleid
              </a>
            </li>
            <li>
              <button type="button" onClick={openCookieSettings} className={linkClassName}>
                Cookie instellingen
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
