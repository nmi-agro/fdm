import type { ComponentProps, MouseEvent } from "react"
import { Link } from "react-router"
import { COOKIE_BANNER_ATTRIBUTE } from "~/components/custom/banner"
import { buttonVariants } from "~/components/ui/button"
import { clientConfig } from "~/lib/config"
import { SIGN_IN_CARD_ID, SIGN_IN_EMAIL_INPUT_ID } from "./sign-in-card"

/**
 * Scrolls to the sign-in card at the top of the page and puts the cursor in the e-mail field.
 * On a low screen it scrolls just far enough to bring the field into view, above the cookie
 * banner while that is open. It never scrolls the field up behind the sticky header: when the
 * banner leaves too little room, the field stays just below the header.
 */
function goToSignIn() {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  const input = document.getElementById(SIGN_IN_EMAIL_INPUT_ID)
  const banner = document.querySelector(`[${COOKIE_BANNER_ATTRIBUTE}]`)
  const header = document.querySelector("header")
  const visibleTop = (header?.getBoundingClientRect().height ?? 0) + 8
  const visibleBottom = banner ? banner.getBoundingClientRect().top : window.innerHeight
  const field = input?.getBoundingClientRect()
  const fieldTop = field ? field.top + window.scrollY : 0
  const fieldBottom = field ? field.bottom + window.scrollY + 24 : 0
  window.scrollTo({
    top: Math.max(0, Math.min(fieldBottom - visibleBottom, fieldTop - visibleTop)),
    behavior: reduce ? "instant" : "smooth",
  })
  input?.focus({ preventScroll: true })
}

/**
 * A button-styled link to the sign-in card. Without JavaScript it is a plain fragment link;
 * with JavaScript it also puts the cursor in the e-mail field.
 */
export function SignInLink({
  className,
  children,
  ...props
}: Omit<ComponentProps<"a">, "href" | "onClick">) {
  return (
    <a
      {...props}
      href={`#${SIGN_IN_CARD_ID}`}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        // Leave modified and non-primary clicks (new tab, new window) to the browser
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return
        event.preventDefault()
        goToSignIn()
      }}
      className={className}
      data-slot="button"
    >
      {children}
    </a>
  )
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
        <a href="#top" className="flex items-center gap-2 rounded-md">
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
          <SignInLink className={buttonVariants({ size: "sm" })}>Aanmelden</SignInLink>
        </div>
      </div>
    </header>
  )
}
