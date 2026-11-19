import { Link } from "react-router"
import { Button, buttonVariants } from "~/components/ui/button"
import { clientConfig } from "~/lib/config"
import { SIGN_IN_EMAIL_INPUT_ID } from "./sign-in-card"

/** Scrolls to the sign-in card at the top of the page and puts the cursor in the e-mail field. */
export function goToSignIn() {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  window.scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" })
  document.getElementById(SIGN_IN_EMAIL_INPUT_ID)?.focus({ preventScroll: true })
}

const NAV_LINKS = [
  { href: "#mogelijkheden", label: "Mogelijkheden" },
  { href: "#samenwerken", label: "Samenwerken" },
  { href: "#over", label: "Over" },
  { href: "#vragen", label: "Veelgestelde vragen" },
]

/** Header of the public landing page: always visible, so the manual and sign-in stay one click away. */
export function LandingHeader() {
  return (
    <header className="bg-background sticky top-0 z-40 h-14 border-b">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-4 px-4 lg:px-8">
        <a href="/signin" className="flex items-center gap-2 rounded-md">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#122023]">
            <img className="size-6" src={clientConfig.logomark} alt="" />
          </span>
          <span className="font-semibold">{clientConfig.name}</span>
        </a>
        <nav aria-label="Op deze pagina" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              data-slot="button"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/manual"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            data-slot="button"
          >
            Handleiding
          </Link>
          <Button size="sm" onClick={goToSignIn}>
            Aanmelden
          </Button>
        </div>
      </div>
    </header>
  )
}
