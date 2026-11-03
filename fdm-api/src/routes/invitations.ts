import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  acceptInvitation,
  declineInvitation,
  FdmType,
  listPendingInvitationsForUser,
} from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError, getErrorMessages } from "../error"
import { FarmIdSchema } from "../fields"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  problemResponseDefinition,
  serializeDate,
  writeErrorResponses,
} from "../schemas"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/** Defines the invitation functions required by the invitation routes. */
export interface InvitationServices {
  listPendingInvitationsForUser: typeof listPendingInvitationsForUser
  acceptInvitation: typeof acceptInvitation
  declineInvitation: typeof declineInvitation
}

const InvitationIdSchema = z
  .string()
  .min(1)
  .describe("Unique identifier of the invitation.")
  .openapi({ param: { name: "invitation_id", in: "path" } })

const InvitationSchema = z
  .object({
    invitation_id: z.string().describe("Unique identifier of the invitation."),
    b_id_farm: FarmIdSchema.describe("Unique identifier of the farm the invitation is for."),
    b_name_farm: z
      .string()
      .nullable()
      .describe("Name of the farm. `null` when the farm has no name."),
    role: z
      .enum(["owner", "advisor", "researcher"])
      .describe(
        "Role offered on the farm: `owner` (full access, can share), `advisor` (read and write) or `researcher` (read only).",
      ),
    organization_name: z
      .string()
      .nullable()
      .describe(
        "Name of the organization the invitation is addressed to, when it is for one of your organizations. `null` for an invitation addressed to you personally.",
      ),
    can_accept: z
      .boolean()
      .describe(
        "True when you can accept or decline the invitation. For an organization, only its owners and admins can.",
      ),
    expires: z.string().describe("Date the invitation expires, in YYYY-MM-DD format."),
  })
  .openapi("Invitation")

const listInvitationsRoute = createRoute({
  method: "get",
  path: "/invitations",
  tags: ["Invitations"],
  summary: "List your pending farm invitations",
  description:
    "Returns the pending farm invitations for the owner of the API key, including invitations for organizations they are a member of.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  responses: {
    200: {
      description: "The pending invitations.",
      content: { "application/json": { schema: z.array(InvitationSchema) } },
    },
    ...commonErrorResponses,
  },
})

function respondRoute(action: "accept" | "decline") {
  return createRoute({
    method: "post",
    path: `/invitations/{invitation_id}/${action}`,
    tags: ["Invitations"],
    summary: action === "accept" ? "Accept a farm invitation" : "Decline a farm invitation",
    description:
      action === "accept"
        ? "Accepts a pending farm invitation, which gives you (or your organization) the offered role on the farm. Your email address must be verified."
        : "Declines a pending farm invitation. Your email address must be verified.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    "x-badges": [{ name: "New", color: "#16a34a" }],
    request: { params: z.object({ invitation_id: InvitationIdSchema }) },
    responses: {
      204: {
        description: action === "accept" ? "Invitation accepted." : "Invitation declined.",
      },
      409: problemResponseDefinition(
        "Conflict — the invitation has already been accepted, declined or has expired.",
      ),
      ...commonErrorResponses,
      422: writeErrorResponses[422],
    },
  })
}

const acceptInvitationRoute = respondRoute("accept")
const declineInvitationRoute = respondRoute("decline")

/**
 * Translates the validation errors of `acceptInvitation` and `declineInvitation` into API errors.
 */
function toInvitationError(err: unknown): never {
  const messages = getErrorMessages(err)
  const has = (text: string) => messages.some((message) => message.includes(text))
  if (has("Invitation not found")) {
    throw new ApiError(404, "not-found", "Invitation not found.")
  }
  if (has("Invitation is already") || has("Invitation has expired")) {
    throw new ApiError(409, "conflict", "The invitation is no longer pending.")
  }
  if (has("not for you") || has("not for your email") || has("Only admins or owners")) {
    throw new ApiError(403, "forbidden", "You cannot respond to this invitation.")
  }
  if (has("Email must be verified")) {
    throw new ApiError(
      422,
      "unprocessable-entity",
      "Verify your email address before responding to an invitation.",
    )
  }
  throw err
}

/**
 * Registers the routes for the farm invitations of the authenticated user.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Invitation service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerInvitationRoutes(app, fdm, services)
 * ```
 */
export function registerInvitationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: InvitationServices,
): void {
  app.use("/invitations", rateLimitMiddleware(fdm, "general"))
  app.use("/invitations/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listInvitationsHandler: RouteHandler<typeof listInvitationsRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // Invitations are addressed to users, so they are read for the user who owns the API key.
    const invitations = await services.listPendingInvitationsForUser(fdm, principal.userId, true)
    return c.json(
      invitations
        .filter((invitation) => invitation.resource === "farm")
        .map((invitation) => ({
          invitation_id: invitation.invitation_id,
          b_id_farm: invitation.resource_id,
          b_name_farm: invitation.farm_name ?? null,
          role: invitation.role as z.infer<typeof InvitationSchema>["role"],
          organization_name: invitation.org_name ?? null,
          can_accept: (invitation as { can_accept?: boolean }).can_accept ?? true,
          expires: serializeDate(invitation.expires) ?? "",
        })),
      200,
    )
  }

  const acceptInvitationHandler: RouteHandler<typeof acceptInvitationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { invitation_id } = c.req.valid("param") as { invitation_id: string }
    try {
      await services.acceptInvitation(fdm, invitation_id, principal.userId)
    } catch (err) {
      toInvitationError(err)
    }
    return c.newResponse(null, 204)
  }

  const declineInvitationHandler: RouteHandler<typeof declineInvitationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { invitation_id } = c.req.valid("param") as { invitation_id: string }
    try {
      await services.declineInvitation(fdm, invitation_id, principal.userId)
    } catch (err) {
      toInvitationError(err)
    }
    return c.newResponse(null, 204)
  }

  app.openapi(listInvitationsRoute, listInvitationsHandler)
  app.openapi(acceptInvitationRoute, acceptInvitationHandler)
  app.openapi(declineInvitationRoute, declineInvitationHandler)
}
