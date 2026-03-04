import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useNavigation, useSearchParams } from "react-router"
import { useRemixForm } from "remix-hook-form"
import type { z } from "zod"
import { AuthCard } from "~/components/blocks/auth/auth-card"
import { AuthCodeField } from "~/components/blocks/auth/auth-code-field"
import { AuthLayout } from "~/components/blocks/auth/auth-layout"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { auth } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { modifySearchParams } from "~/lib/url-utils"
import { FormSchema } from "../components/blocks/auth/auth-formschema"

export const meta: MetaFunction = () => {
    return [
        { title: `Aanmelden | ${clientConfig.name}` },
        {
            name: "description",
            content: `Meld je aan bij ${clientConfig.name} om toegang te krijgen tot je dashboard en je bedrijfsgegevens te beheren.`,
        },
    ]
}

export async function loader({ request }: LoaderFunctionArgs) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        })

        if (session?.session) {
            return redirect("/farm")
        }

        return {}
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function SignIn() {
    const [searchParams] = useSearchParams()
    const redirectTo = searchParams.get("redirectTo") || "/farm"
    const navigation = useNavigation()
    const formRef = useRef<HTMLFormElement>(null)
    const [isAutoSubmitting, setIsAutoSubmitting] = useState(false)

    const verifyActionUrl = modifySearchParams("/signin/verify", (params) => {
        params.set("redirectTo", redirectTo)
    })

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    const isSubmitting =
        (navigation.state !== "idle" &&
            navigation.formAction?.startsWith("/signin/verify")) ||
        isAutoSubmitting

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onSubmit",
        resolver: zodResolver(FormSchema),
        defaultValues: {
            code: "",
        },
    })

    return (
        <AuthLayout showCookieSettings={true}>
            <AuthCard
                title="Controleer je e-mail inbox"
                description="Een aanmeldcode en link zijn naar je e-mailadres gestuurd."
                contentClassName="space-y-6"
            >
                <p className="text-sm text-muted-foreground text-center">
                    De code en link zijn 15 minuten geldig en kunnen maar één
                    keer worden gebruikt.
                </p>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                            Of vul de code in
                        </span>
                    </div>
                </div>
                <Form
                    ref={formRef}
                    method="POST"
                    action={verifyActionUrl}
                    className="space-y-4"
                    onSubmit={form.handleSubmit}
                >
                    <AuthCodeField
                        control={form.control}
                        onComplete={() => {
                            setIsAutoSubmitting(true)
                            // Trigger programmatic submit which fires onSubmit handler
                            // 1.5s delay so user sees the completed code
                            timeoutRef.current = setTimeout(() => {
                                formRef.current?.requestSubmit()
                            }, 1500)
                        }}
                    />
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center space-x-2">
                                <Spinner />
                                <span>Verifiëren...</span>
                            </div>
                        ) : (
                            "Verifiëren"
                        )}
                    </Button>
                </Form>
            </AuthCard>
        </AuthLayout>
    )
}
