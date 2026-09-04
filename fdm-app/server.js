import "./instrument.server.mjs"

import { createRequestHandler } from "@react-router/express"
import compression from "compression"
import express from "express"
import morgan from "morgan"

const BUILD_PATH = "./build/server/index.js"
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10)

const app = express()

// The app runs behind a TLS-terminating reverse proxy (e.g. Google Cloud Run)
// that forwards the original protocol via the `X-Forwarded-Proto` header.
// Without `trust proxy`, Express (and therefore React Router's single-fetch
// CSRF origin check) sees every request as plain `http://`, which no longer
// matches the browser's `https://` `Origin` header since react-router@8.3.1
// tightened that comparison from host-only to full-origin. See
// ISSUE-react-router-8.3.1-trust-proxy.md for the full analysis.
app.set("trust proxy", true)

// `trust proxy` also makes Express honour `X-Forwarded-Host` when resolving
// `req.hostname`. Cloud Run never sends that header itself, so any value
// present on an incoming request would be attacker-controlled. Strip it
// before it can influence hostname resolution or downstream `Origin` checks.
app.use((req, _res, next) => {
    delete req.headers["x-forwarded-host"]
    next()
})

// Don't advertise the framework.
app.disable("x-powered-by")

app.use(compression())
app.use(morgan("tiny"))

// Static assets emitted with content hashes in their filenames are safe to
// cache forever; everything else under build/client (e.g. favicon, robots.txt)
// gets a short cache lifetime so updates roll out promptly.
app.use(
    "/assets",
    express.static("build/client/assets", {
        immutable: true,
        maxAge: "1y",
    }),
)
app.use(express.static("build/client", { maxAge: "1h" }))

app.all(
    "*",
    createRequestHandler({
        build: () => import(BUILD_PATH),
        mode: process.env.NODE_ENV,
    }),
)

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
})
