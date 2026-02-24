import { zodResolver } from "@hookform/resolvers/zod"
import { updateUserProfile } from "@nmi-agro/fdm-core"
import { Cookie } from "lucide-react"
import type {
    ActionFunctionArgs,
    LoaderFunctionArgs,
    MetaFunction,
} from "react-router"
import { Form, useLoaderData } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { Avatar, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "../lib/form"

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
            error: (issue) =>
                issue.input === undefined ? "Vul je voornaam in" : undefined,
        })
        .min(1, {
            error: "Vul je voornaam in",
        }),
    surname: z
        .string({
            error: (issue) =>
                issue.input === undefined ? "Vul je achternaam in" : undefined,
        })
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
    const openCookieSettings = () => {
        if (window?.openCookieSettings) {
            window.openCookieSettings()
        }
    }
    const onOpenCookieSettings = () => {
        openCookieSettings()
    }

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: {
            firstname: loaderData.firstname || "",
            surname: loaderData.surname || "",
        },
    })

    return (
        <div className="w-full h-screen lg:grid lg:grid-cols-2 overflow-hidden">
            <div className="flex h-full items-start justify-center overflow-y-auto py-6">
                <div className="mx-auto grid w-[350px] gap-6">
                    <Card className="shadow-xl">
                        <CardHeader className="text-center">
                            <div className="flex justify-center mb-2">
                                <div className="flex aspect-square size-16 items-center justify-center rounded-lg bg-[#122023]">
                                    <img
                                        className="size-12"
                                        src={clientConfig.logomark}
                                        alt={clientConfig.name}
                                    />
                                </div>
                            </div>
                            <h2 className="text-lg font-semibold tracking-tight text-muted-foreground mb-2">
                                {clientConfig.name}
                            </h2>
                            <CardTitle className="text-xl">
                                Profiel voltooien
                            </CardTitle>
                            <CardDescription>
                                {`Welkom bij ${clientConfig.name}. Om verder te gaan maken we eerst je profiel compleet.`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <RemixFormProvider {...form}>
                                <Form
                                    id="formWelcome"
                                    onSubmit={form.handleSubmit}
                                    method="POST"
                                >
                                    <fieldset
                                        disabled={form.formState.isSubmitting}
                                    >
                                        <div className="grid w-full items-center gap-4">
                                            {loaderData.image ? (
                                                <div className="flex flex-col justify-self-center">
                                                    <Avatar className="h-12 w-12 rounded-lg">
                                                        <AvatarImage
                                                            src={
                                                                loaderData.image
                                                            }
                                                        />
                                                    </Avatar>
                                                </div>
                                            ) : null}
                                            <div className="flex flex-col space-y-1.5">
                                                <FormField
                                                    control={form.control}
                                                    name="firstname"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Voornaam
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="bv. Jan"
                                                                    aria-required="true"
                                                                    required
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormDescription />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <div className="flex flex-col space-y-1.5">
                                                <FormField
                                                    control={form.control}
                                                    name="surname"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Achternaam
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="bv. de Vries"
                                                                    aria-required="true"
                                                                    required
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormDescription />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <Button
                                                type="submit"
                                                className="w-full"
                                            >
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
                            </RemixFormProvider>
                        </CardContent>
                        <CardFooter className="flex justify-center" />
                    </Card>
                </div>
            </div>
            <div className="hidden bg-muted lg:block">
                <img
                    src="https://images.unsplash.com/photo-1625565570971-e6b404974366?q=80&w=1930&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                    alt="Herd of cows on green grass field during daytime by Rickie-Tom Schünemann on Unsplash"
                    width="1920"
                    height="1080"
                    loading="lazy"
                    className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
                />
            </div>
            <div className="fixed bottom-3 left-3 z-50">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs flex items-center gap-1 opacity-70 hover:opacity-100 bg-card/80 hover:bg-card border border-border"
                    onClick={onOpenCookieSettings}
                >
                    <Cookie className="h-3 w-3" />
                    <span>Cookie instellingen</span>
                </Button>
            </div>
        </div>
    )
}

export async function action({ request }: ActionFunctionArgs) {
    try {
        // Get the URL object to extract search params
        const url = new URL(request.url)
        const redirectTo = url.searchParams.get("redirectTo") || "/farm"
        // Validate redirectTo to prevent open redirect
        const isValidRedirect =
            redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        const safeRedirectTo = isValidRedirect ? redirectTo : "/farm"

        // Get form values
        const formValues = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )
        const { firstname, surname } = formValues

        // Get the current user profile
        const session = await auth.api.getSession({
            headers: request.headers,
        })

        // Update the user profile
        await updateUserProfile(fdm, session.user.id, firstname, surname)

        return redirectWithSuccess(safeRedirectTo, "Je profiel is voltooid!")
    } catch (error) {
        console.error("Error updating user profile")
        return handleActionError(error)
    }
}
