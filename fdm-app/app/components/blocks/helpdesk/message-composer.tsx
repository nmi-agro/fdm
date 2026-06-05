import { zodResolver } from "@hookform/resolvers/zod"
import { useId } from "react"
import { Controller, useWatch } from "react-hook-form"
import { useFetcher } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type z from "zod"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "~/components/ui/field"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { Message } from "./message"
import { MessageSchema } from "./message-schema"
import type { HelpdeskUser } from "./types"

const formDefaultValues = {
    body: "",
    sender_type: "customer",
    is_internal: false,
} as const

export function MessageComposer({
    intent,
    principal,
    showAgentControls,
    defaultValues = { ...formDefaultValues },
    className,
}: {
    intent: string
    principal: HelpdeskUser | null
    showAgentControls?: boolean
    defaultValues?: z.infer<typeof MessageSchema>
    className?: string
}) {
    const fetcher = useFetcher()

    const form = useRemixForm({
        mode: "onTouched",
        resolver: zodResolver(MessageSchema),
        stringifyAllValues: false,
        defaultValues: {
            ...formDefaultValues,
            intent: intent,
            ...defaultValues,
        },
    })
    const sender_role = useWatch({ name: "sender_role", control: form.control })
    const is_internal = useWatch({ name: "is_internal", control: form.control })
    const messageInputId = useId()

    const isSubmitting = fetcher.state !== "idle"

    return (
        <RemixFormProvider {...form}>
            <fetcher.Form
                method="post"
                onSubmit={form.handleSubmit}
                className={className}
            >
                <input type="hidden" name="intent" value={intent} />
                <Message
                    principal={principal}
                    isInternal={is_internal}
                    title={
                        <fieldset
                            disabled={isSubmitting}
                            className="w-full flex flex-row items-center gap-2 md:gap-4"
                        >
                            <span className="min-w-0 flex-1">
                                {is_internal ? (
                                    <>
                                        Nieuw <i className="italic">intern</i>{" "}
                                        bericht
                                    </>
                                ) : (
                                    "Nieuw bericht"
                                )}
                            </span>
                            {showAgentControls && (
                                <>
                                    <Controller
                                        name="is_internal"
                                        render={({ field, fieldState }) => (
                                            <div>
                                                <div
                                                    data-invalid={
                                                        fieldState.invalid
                                                    }
                                                    className={cn(
                                                        "flex w-auto shrink-0 grow-0 flex-row items-center gap-2",
                                                        sender_role !==
                                                            "agent" &&
                                                            "invisible",
                                                    )}
                                                >
                                                    <FieldLabel className="whitespace-nowrap text-xs">
                                                        Intern
                                                    </FieldLabel>
                                                    <Switch
                                                        checked={
                                                            field.value as boolean
                                                        }
                                                        onCheckedChange={
                                                            field.onChange
                                                        }
                                                        className="mt-1"
                                                        disabled={isSubmitting}
                                                    />
                                                </div>
                                                <FieldError
                                                    errors={[fieldState.error]}
                                                />
                                            </div>
                                        )}
                                    />
                                    <Controller
                                        name="sender_role"
                                        render={({ field, fieldState }) => (
                                            <div
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                                className="w-auto shrink-0 grow-0"
                                            >
                                                <Select
                                                    value={field.value}
                                                    onValueChange={(value) => {
                                                        form.setValue(
                                                            "sender_role",
                                                            value as
                                                                | "agent"
                                                                | "customer",
                                                        )
                                                        if (value !== "agent") {
                                                            form.setValue(
                                                                "is_internal",
                                                                false,
                                                            )
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="bg-card w-auto min-w-0 text-xs px-4">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="agent">
                                                            als medewerker
                                                        </SelectItem>
                                                        <SelectItem value="customer">
                                                            als gebruiker
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FieldError
                                                    errors={[fieldState.error]}
                                                />
                                            </div>
                                        )}
                                    />
                                </>
                            )}
                        </fieldset>
                    }
                >
                    <fieldset disabled={isSubmitting}>
                        <Controller
                            name="body"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldContent>
                                        <Textarea
                                            {...field}
                                            className="bg-card"
                                            id={messageInputId}
                                            placeholder={
                                                "Schrijf uw bericht hier..."
                                            }
                                        />
                                        <FieldDescription>
                                            {showAgentControls
                                                ? sender_role === "agent"
                                                    ? is_internal
                                                        ? "Intern bericht — alleen zichtbaar voor medewerkers."
                                                        : "Dit bericht wordt als medewerker verstuurd en is zichtbaar voor de gebruiker."
                                                    : "Dit bericht wordt verstuurd als de gebruiker."
                                                : "Voeg aanvullende informatie toe of stel een vervolgvraag. U ontvangt een kopie per e-mail."}
                                        </FieldDescription>
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    </FieldContent>
                                </Field>
                            )}
                        />
                    </fieldset>
                    <Button
                        type="submit"
                        className="block ms-auto min-w-0"
                        disabled={isSubmitting}
                    >
                        Versturen
                        {isSubmitting && <Spinner />}
                    </Button>
                </Message>
            </fetcher.Form>
        </RemixFormProvider>
    )
}
