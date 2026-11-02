import { isAPIError } from "better-auth/api"
import { useEffect } from "react"
import {
  type ActionFunctionArgs,
  data,
  Form,
  isRouteErrorResponse,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useSearchParams,
  useSubmit,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import z from "zod"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { extractFormValuesFromRequest } from "~/lib/form"
import { getOrganizationRoleLabel } from "~/lib/organization-helpers"
import type { Route } from "./+types/organization.invitations.$invitation_id.respond"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Uitnodiging - Organisatie | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk jouw uitnodiging.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getSession(request)

  // Check for valid invitation id
  const invitationId = params.invitation_id
  if (!invitationId) {
    throw data("Invitation not found", {
      status: 404,
      statusText: "Invitation not found",
    })
  }
  return getPendingInvitation(invitationId, request.headers, session.user.email)
}

/** Why an invitation link can no longer be used, shown to the user by the error boundary. */
type InvitationUnavailableReason = "expired" | "accepted" | "rejected" | "canceled" | "not_found"

/**
 * Fetches a pending invitation addressed to the signed-in user.
 *
 * better-auth's `getInvitation` throws an `APIError` instead of returning `null` when the
 * invitation does not exist, is no longer pending, has expired, or is addressed to someone else.
 * In that case the invitation is looked up to tell the user why it can no longer be used, so that
 * the route's error boundary shows a matching message instead of the generic error page.
 *
 * @param invitationId - The id of the invitation from the route params.
 * @param headers - The request headers, used by better-auth to resolve the session.
 * @param email - The e-mail address of the signed-in user.
 * @returns The invitation.
 * @throws {Response} A 410 with the reason as data when the user's invitation was accepted,
 *   rejected, cancelled or has expired, or a 404 when it is not available to the signed-in user.
 */
async function getPendingInvitation(invitationId: string, headers: Headers, email: string) {
  try {
    const invitation = await auth.api.getInvitation({
      query: {
        id: invitationId,
      },
      headers,
    })
    if (invitation) return invitation
  } catch (error) {
    if (!isAPIError(error)) throw error
  }
  const reason = await getInvitationUnavailableReason(invitationId, email)
  if (reason !== "not_found") {
    throw data({ reason }, { status: 410, statusText: "Invitation no longer valid" })
  }
  throw data("Uitnodiging niet gevonden", {
    status: 404,
    statusText: "Invitation not found",
  })
}

/**
 * Determines why an invitation can no longer be used. Invitations addressed to another e-mail
 * address are reported as `not_found`, so this does not reveal anything about them.
 *
 * @param invitationId - The id of the invitation from the route params.
 * @param email - The e-mail address of the signed-in user.
 * @returns The reason the invitation is unavailable.
 */
async function getInvitationUnavailableReason(
  invitationId: string,
  email: string,
): Promise<InvitationUnavailableReason> {
  const { adapter } = await auth.$context
  const invitation = await adapter.findOne<{ email: string; status: string; expiresAt: Date }>({
    model: "invitation",
    where: [{ field: "id", value: invitationId }],
  })
  if (!invitation || invitation.email.toLowerCase() !== email.toLowerCase()) {
    return "not_found"
  }
  if (
    invitation.status === "accepted" ||
    invitation.status === "rejected" ||
    invitation.status === "canceled"
  ) {
    return invitation.status
  }
  if (new Date(invitation.expiresAt) < new Date()) return "expired"
  return "not_found"
}

/**
 * Reads the reason from the data of a 410 error response; any other data means `not_found`.
 *
 * @param errorData - The `data` of the route error response.
 * @returns The reason the invitation is unavailable.
 */
function getInvitationUnavailableReasonFromError(errorData: unknown): InvitationUnavailableReason {
  if (
    typeof errorData === "object" &&
    errorData !== null &&
    "reason" in errorData &&
    typeof errorData.reason === "string" &&
    Object.hasOwn(invitationUnavailableMessages, errorData.reason)
  ) {
    return errorData.reason as InvitationUnavailableReason
  }
  return "not_found"
}

/** Title and explanation shown for each reason an invitation can no longer be used. */
const invitationUnavailableMessages: Record<
  InvitationUnavailableReason,
  { title: string; description: string }
> = {
  expired: {
    title: "Uitnodiging verlopen",
    description:
      "Deze uitnodiging is verlopen. Vraag degene die je heeft uitgenodigd om je opnieuw uit te nodigen.",
  },
  accepted: {
    title: "Uitnodiging al geaccepteerd",
    description:
      "Je hebt deze uitnodiging al geaccepteerd. Je vindt de organisatie bij je organisaties.",
  },
  rejected: {
    title: "Uitnodiging afgewezen",
    description:
      "Je hebt deze uitnodiging eerder afgewezen. Wil je toch lid worden? Vraag dan degene die je heeft uitgenodigd om een nieuwe uitnodiging.",
  },
  canceled: {
    title: "Uitnodiging ingetrokken",
    description:
      "Deze uitnodiging is ingetrokken door de organisatie. Neem contact op met degene die je heeft uitgenodigd als je denkt dat dit niet klopt.",
  },
  not_found: {
    title: "Uitnodiging niet beschikbaar",
    description:
      "Helaas, deze uitnodiging is niet langer geldig of bestaat niet. Neem eventueel contact op met degene die je heeft uitgenodigd voor een nieuwe uitnodiging.",
  },
}

export default function Respond() {
  const invitation = useLoaderData<typeof loader>()

  const [searchParams] = useSearchParams()
  const intentRaw = searchParams.get("intent")
  const intent = intentRaw != null ? intentRaw.toLowerCase() : null

  const submit = useSubmit()

  useEffect(() => {
    if (intent && intent === "accept") {
      void submit(
        {
          intent: "accept",
        },
        { method: "POST" },
      )
    }
  }, [intent, submit])

  if (intent !== "accept" && intent !== "reject" && intent !== "do_nothing") {
    throw new Error(`Invalid intent: ${intent}`)
  }

  if (intent === "accept") {
    return (
      <h1 className="text-primary mt-50 text-center text-3xl font-semibold">
        Uitnodiging wordt geaccepteerd...
      </h1>
    )
  }

  return (
    <div className="mx-auto my-4 max-w-3xl px-4">
      <Card>
        <CardHeader>
          <CardTitle>Uitnodiging afwijzen</CardTitle>
        </CardHeader>
        <CardContent>
          <Separator />
          <p className="my-1">
            {`${invitation.inviterEmail} heeft je uitgenodigd om lid te worden van de organisatie `}
            <span className="font-semibold">{`${invitation.organizationName}.`}</span>
          </p>
          <p className="my-1">
            Je bent uitgenodigd als{" "}
            <i className="font-semibold">{getOrganizationRoleLabel(invitation.role)}</i>
          </p>
          <p className="my-1">Weet je zeker dat je deze uitnodiging wilt afwijzen?</p>
        </CardContent>
        <CardFooter>
          <Form method="post" className="flex flex-row gap-2">
            <input type="hidden" name="invitation_id" value={invitation.id} />
            <Button variant="destructive" name="intent" value="reject">
              Ja, afwijzen
            </Button>
            <Button variant="secondary" name="intent" value="do_nothing">
              Nee, terug naar Mijn Uitnodigingen
            </Button>
          </Form>
        </CardFooter>
      </Card>
    </div>
  )
}

const FormSchema = z.object({
  intent: z.enum(["accept", "reject", "do_nothing"]),
})

export async function action({ request, params }: ActionFunctionArgs) {
  const formValues = await extractFormValuesFromRequest(request, FormSchema)

  const session = await getSession(request)

  // Leaving the page does not need the invitation, so it also works when the invitation is no
  // longer valid (the button on the error card uses this intent).
  if (formValues.intent === "do_nothing") {
    return redirect("/organization")
  }

  const invitationId = params.invitation_id
  if (!invitationId) {
    throw data("Invitation not found", {
      status: 404,
      statusText: "Invitation not found",
    })
  }
  const invitation = await getPendingInvitation(invitationId, request.headers, session.user.email)

  if (formValues.intent === "accept") {
    try {
      await auth.api.acceptInvitation({
        headers: request.headers,
        body: { invitationId: invitationId },
      })
    } catch (error) {
      console.error("Failed to accept invitation:", error)
      throw data("Failed to accept invitation", { status: 400 })
    }

    const organization = await auth.api.getFullOrganization({
      query: {
        organizationId: invitation.organizationId,
      },
      headers: request.headers,
    })
    if (!organization) {
      throw data("Organization not found", 404)
    }
    const organizationSlug = organization.slug

    return redirectWithSuccess(`/organization/${organizationSlug}`, {
      message: "Uitnodiging geaccepteerd! 🎉",
    })
  }

  if (formValues.intent === "reject") {
    try {
      await auth.api.rejectInvitation({
        headers: request.headers,
        body: { invitationId: invitationId },
      })
    } catch {
      throw data("Invitation not found", 404)
    }
    return redirectWithSuccess("/organization", {
      message: "Uitnodiging afgewezen",
    })
  }

  throw new Error("invalid intent")
}

export function ErrorBoundary(props: Route.ErrorBoundaryProps) {
  const error = props.error
  if (isRouteErrorResponse(error)) {
    if (error.status === 404 || error.status === 410) {
      const reason = getInvitationUnavailableReasonFromError(error.data)
      const message = invitationUnavailableMessages[reason]
      return (
        <div className="mx-auto my-4 max-w-3xl px-4">
          <Card>
            <CardHeader>
              <CardTitle>{message.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <Separator />
              <p className="my-1">{message.description}</p>
            </CardContent>
            <CardFooter>
              <Form method="post" className="flex flex-row gap-2">
                <input type="hidden" name="invitation_id" value={props.params.invitation_id} />
                <Button variant="secondary" name="intent" value="do_nothing">
                  Terug naar mijn organisaties
                </Button>
              </Form>
            </CardFooter>
          </Card>
        </div>
      )
    }
  }

  throw error
}
