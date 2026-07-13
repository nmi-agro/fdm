import type { Resolver } from "react-hook-form"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { updateUserProfile } from "@nmi-agro/fdm-core"
import { Controller } from "react-hook-form"
import { Form, redirect, useLoaderData } from "react-router"
import { useRemixForm } from "remix-hook-form"
import { redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { AuthCard } from "~/components/blocks/auth/auth-card"
import { AuthLayout } from "~/components/blocks/auth/auth-layout"
import { Avatar, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"

export const meta: MetaFunction = () => {
  return [
    { title: `Welkom | ${clientConfig.name}` },
    {
      name: "description",
      content: `Welkom bij ${clientConfig.name}. Maak je profiel compleet om door te gaan.`,
    },
  ]
}

const FormSchema = z.object({
  firstname: z
    .string({
      error: (issue) => (issue.input === undefined ? "Vul je voornaam in" : undefined),
    })
    .trim()
    .min(1, {
      error: "Vul je voornaam in",
    }),
  surname: z
    .string({
      error: (issue) => (issue.input === undefined ? "Vul je achternaam in" : undefined),
    })
    .trim()
    .min(1, {
      error: "Vul je achternaam in",
    }),
})

/**
 * Checks for an existing user session and redirects authenticated users.
 *
 * This asynchronous loader function retrieves the user session from the request headers
 * via the authentication API. If a valid session exists, the function redirects the user
 * to the "/farm" route; otherwise, it returns an empty object. Any errors during session
 * retrieval are processed by {@link handleLoaderError} and thrown.
 *
 * @param request - The HTTP request object whose headers are used to retrieve the session.
 *
 * @returns A redirect response to "/farm" if a session exists, or an empty object otherwise.
 *
 * @throws {Error} If session retrieval fails, the error processed by {@link handleLoaderError} is thrown.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get the session
    const session = await getSession(request)

    // Return user information from loader
    return {
      firstname: session.user.firstname,
      surname: session.user.surname,
      image: session.user.image,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Renders the welcome page for profile completion.
 *
 * This component displays a form for users to complete their profile by entering their firstname and surname.
 * It shows the user's avatar if available and handles form submission with validation.
 *
 * @returns A React element representing the profile completion page.
 */
export default function Welcome() {
  const loaderData = useLoaderData<typeof loader>()

  const form = useRemixForm<z.infer<typeof FormSchema>>({
    mode: "onTouched",
    resolver: zodResolver(FormSchema) as Resolver<z.infer<typeof FormSchema>>,
    defaultValues: {
      firstname: loaderData.firstname || "",
      surname: loaderData.surname || "",
    },
  })

  return (
    <AuthLayout showCookieSettings={true}>
      <AuthCard
        title="Profiel voltooien"
        description={`Welkom bij ${clientConfig.name}. Vul je naam aan om direct te starten met je percelen, bemesting en bodemdata.`}
        footer={
          <p className="text-muted-foreground text-center text-xs">
            Je kunt dit later altijd aanpassen via je profielinstellingen.
          </p>
        }
      >
        <Form id="formWelcome" onSubmit={form.handleSubmit} method="post">
          <fieldset disabled={form.formState.isSubmitting}>
            <div className="grid w-full items-center gap-4">
              {loaderData.image ? (
                <div className="flex flex-col justify-self-center">
                  <Avatar className="h-12 w-12 rounded-lg">
                    <AvatarImage src={loaderData.image} />
                  </Avatar>
                </div>
              ) : null}
              <Controller
                control={form.control}
                name="firstname"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Voornaam</FieldLabel>
                    <Input placeholder="bv. Jan" aria-required="true" required {...field} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="surname"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Achternaam</FieldLabel>
                    <Input placeholder="bv. de Vries" aria-required="true" required {...field} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Button type="submit" className="w-full">
                {form.formState.isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <Spinner />
                    <span>Opslaan...</span>
                  </div>
                ) : (
                  "Doorgaan"
                )}
              </Button>
            </div>
          </fieldset>
        </Form>
      </AuthCard>
    </AuthLayout>
  )
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get the URL object to extract search params
    const url = new URL(request.url)
    const redirectTo = url.searchParams.get("redirectTo") || "/farm"
    // Validate redirectTo to prevent open redirect
    const isValidRedirect = redirectTo.startsWith("/") && !redirectTo.startsWith("//")
    const safeRedirectTo = isValidRedirect ? redirectTo : "/farm"

    // Get form values
    const formValues = await extractFormValuesFromRequest(request, FormSchema)
    const { firstname, surname } = formValues

    // Get the current user profile
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      return redirect("/signin")
    }

    // Update the user profile
    await updateUserProfile(fdm, session.user.id, firstname, surname)

    return redirectWithSuccess(safeRedirectTo, "Je profiel is voltooid!")
  } catch (error) {
    console.error("Error updating user profile")
    return handleActionError(error)
  }
}
