import type z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useId, useRef } from "react"
import { Controller, useWatch } from "react-hook-form"
import { useFetcher } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
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
import { ALLOWED_ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_SIZE, MAX_ATTACHMENTS } from "~/lib/upload-utils"
import type { HelpdeskUser } from "./types"
import { AttachmentDropzone } from "./attachment-dropzone"
import { Message } from "./message"
import { MessageSchema } from "./message-schema"

const formDefaultValues = {
  body: "",
  sender_type: "customer",
  is_internal: false,
  attachments: [],
} as const

export function MessageComposer({
  intent,
  principal,
  showAgentControls,
  defaultValues,
  className,
}: {
  intent: string
  principal: HelpdeskUser | null
  showAgentControls?: boolean
  defaultValues?: z.infer<typeof MessageSchema>
  className?: string
}) {
  const fetcher = useFetcher()
  const formRef = useRef<HTMLFormElement>(null)

  const form = useRemixForm({
    mode: "onTouched",
    resolver: zodResolver(MessageSchema),
    stringifyAllValues: false,
    defaultValues: {
      ...formDefaultValues,
      intent: intent,
      ...defaultValues,
    },
    submitHandlers: {
      onValid() {
        if (!formRef.current) return
        fetcher.submit(new FormData(formRef.current), {
          method: "POST",
          encType: "multipart/form-data",
        })
      },
    },
  })
  const sender_role = useWatch({ name: "sender_role", control: form.control })
  const is_internal = useWatch({ name: "is_internal", control: form.control })

  const lastProcessedActionData = useRef<any>(undefined)
  useEffect(() => {
    if (fetcher.data != lastProcessedActionData.current && fetcher.data?.resetMessageForm) {
      form.reset({
        ...formDefaultValues,
        intent: intent,
        ...defaultValues,
      })
    }
    lastProcessedActionData.current = fetcher.data
  }, [fetcher.data, defaultValues, form, intent])

  const messageInputId = useId()
  const isSubmitting = fetcher.state !== "idle"

  return (
    <RemixFormProvider {...form}>
      <form
        ref={formRef}
        method="post"
        encType="multipart/form-data"
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
              className="flex w-full flex-row items-center gap-2 md:gap-4"
            >
              <span className="min-w-0 flex-1">
                {is_internal ? (
                  <>
                    Nieuw <i className="italic">intern</i> bericht
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
                          data-invalid={fieldState.invalid}
                          className={cn(
                            "flex w-auto shrink-0 grow-0 flex-row items-center gap-2",
                            sender_role !== "agent" && "invisible",
                          )}
                        >
                          <FieldLabel className="text-xs whitespace-nowrap">Intern</FieldLabel>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                            className="mt-1"
                            disabled={isSubmitting}
                          />
                        </div>
                        <FieldError errors={[fieldState.error]} />
                      </div>
                    )}
                  />
                  <Controller
                    name="sender_role"
                    render={({ field, fieldState }) => (
                      <div data-invalid={fieldState.invalid} className="w-auto shrink-0 grow-0">
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            form.setValue("sender_role", value as "agent" | "customer")
                            if (value !== "agent") {
                              form.setValue("is_internal", false)
                            }
                          }}
                        >
                          <SelectTrigger className="bg-card w-auto min-w-0 px-4 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agent">als medewerker</SelectItem>
                            <SelectItem value="customer">als gebruiker</SelectItem>
                          </SelectContent>
                        </Select>
                        <FieldError errors={[fieldState.error]} />
                      </div>
                    )}
                  />
                </>
              )}
            </fieldset>
          }
        >
          <fieldset disabled={isSubmitting} className="space-y-2">
            <Controller
              name="body"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldContent>
                    <Textarea
                      {...field}
                      className="bg-card"
                      id={messageInputId}
                      placeholder={"Schrijf uw bericht hier..."}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </FieldContent>
                </Field>
              )}
            />
            <Controller
              name="attachments"
              render={({ field }) => {
                return (
                  <Field>
                    <FieldTitle className="text-muted-foreground font-normal">Bijlagen</FieldTitle>
                    <AttachmentDropzone
                      name={"attachments"}
                      accept={ALLOWED_ATTACHMENT_EXTENSIONS}
                      maxSize={MAX_ATTACHMENT_SIZE}
                      maxFiles={showAgentControls ? undefined : MAX_ATTACHMENTS}
                      value={field.value}
                      onFilesChange={field.onChange}
                    />
                  </Field>
                )
              }}
            />
            <Field>
              <FieldDescription>
                {showAgentControls
                  ? sender_role === "agent"
                    ? is_internal
                      ? "Intern bericht — alleen zichtbaar voor medewerkers."
                      : "Dit bericht wordt als medewerker verstuurd en is zichtbaar voor de gebruiker."
                    : "Dit bericht wordt verstuurd als de gebruiker."
                  : "Voeg aanvullende informatie toe of stel een vervolgvraag. U ontvangt een kopie per e-mail."}
              </FieldDescription>
            </Field>
          </fieldset>
          <Button type="submit" className="ms-auto block min-w-0" disabled={isSubmitting}>
            Versturen
            {isSubmitting && <Spinner />}
          </Button>
        </Message>
      </form>
    </RemixFormProvider>
  )
}
