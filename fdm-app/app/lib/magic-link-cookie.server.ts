import { createCookie } from "react-router"
import { serverConfig } from "~/lib/config.server"

const sessionSecret = serverConfig.auth.fdm_session_secret
if (!sessionSecret?.trim() || sessionSecret === "undefined") {
  throw new Error("FDM_SESSION_SECRET is missing or invalid. Cannot initialize magic-link cookie.")
}

/**
 * Short-lived cookie that carries the plaintext email address between the
 * sign-in, check-your-email, and verify steps of the magic-link flow.
 *
 * The email is deliberately kept out of the URL (query params end up in
 * server access logs, browser history, and the `Referer` header) while still
 * letting the UI show a masked version and support resending the code.
 */
export const magicLinkCookie = createCookie("magic_link_email", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 900, // 15 minutes — matches the magic-link/code validity window
  secrets: [sessionSecret],
})
