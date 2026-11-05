import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { User, Users } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Form, useNavigation, useSubmit } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import isEmail from "validator/lib/isEmail"
import { AutoComplete } from "~/components/custom/autocomplete"
import { Button } from "~/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { AccessFormSchema } from "~/lib/schemas/access.schema"

// Define the type for the principal object based on usage
type Principal = {
  username: string
  email?: string | null
  displayUserName: string | null
  image?: string | null
  initials: string
  role: string
  type: "user" | "organization"
  status: "active" | "pending"
  invitation_id?: string
  invitation_expires_at?: Date | string
}

type InvitationFormProps = {
  principals: Principal[]
}

export const InvitationForm = ({ principals }: InvitationFormProps) => {
  const submit = useSubmit()
  const navigation = useNavigation()
  const isSubmitting = navigation.state !== "idle"
  const wasSubmitting = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [selectedValue, setSelectedValue] = useState<string>("")
  const form = useRemixForm<z.infer<typeof AccessFormSchema>>({
    mode: "onTouched",
    resolver: zodResolver(AccessFormSchema),
    defaultValues: {
      role: "advisor", // Set default role
      intent: "invite_user",
    },
    submitHandlers: {
      onValid: (data) => {
        void submit(
          {
            username: data.username ?? "",
            role: (data.role as string) ?? "advisor",
            intent: "invite_user",
          },
          { method: "post" },
        )
      },
    },
  })

  // Reset form and autocomplete input when submission completes
  const formGetValues = form.getValues
  const formReset = form.reset
  useEffect(() => {
    if (wasSubmitting.current && navigation.state === "idle") {
      setSelectedValue("")
      formReset({ role: formGetValues("role"), intent: "invite_user" })
    }
    wasSubmitting.current = navigation.state !== "idle"
  }, [navigation.state, formReset, formGetValues])

  // Define icon map for AutoComplete
  const iconMap = { user: User, organization: Users }

  return (
    <RemixFormProvider {...form}>
      <Form ref={formRef} method="post" onSubmit={form.handleSubmit} className="space-y-2">
        <fieldset disabled={isSubmitting} className="flex items-center justify-between space-x-4">
          <AutoComplete
            className="flex-1"
            lookupUrl="/api/lookup/principal"
            excludeValues={principals.flatMap((p) =>
              p.email ? [p.username, p.email] : [p.username],
            )}
            iconMap={iconMap}
            selectedValue={selectedValue}
            onSelectedValueChange={(value) => {
              setSelectedValue(value ?? "")
              form.setValue("username", value ?? "", { shouldTouch: true })
            }}
            emptyMessage={(value) => {
              const typedEmail = value.trim().toLowerCase()
              // The lookup hides principals that already have access, so detect them here
              const existingPrincipal = principals.find(
                (p) =>
                  p.username.toLowerCase() === typedEmail || p.email?.toLowerCase() === typedEmail,
              )
              if (existingPrincipal) {
                return existingPrincipal.status === "pending"
                  ? `${value.trim()} is al uitgenodigd.`
                  : `${value.trim()} heeft al toegang.`
              }
              if (isEmail(value.trim())) {
                return (
                  <button
                    className="w-full cursor-pointer text-center hover:underline"
                    onClick={() => {
                      form.setValue("username", value.trim(), {
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                      formRef.current?.requestSubmit()
                    }}
                    type="button"
                  >
                    Nodig {value.trim()} uit voor toegang als{" "}
                    {form.getValues("role") === "owner"
                      ? "eigenaar"
                      : form.getValues("role") === "advisor"
                        ? "adviseur"
                        : "onderzoeker"}
                    .
                  </button>
                )
              }
              return value.includes("@")
                ? "Vul het volledige e-mailadres in."
                : "Geen organisatie gevonden. Wil je een persoon toevoegen? Vul dan het volledige e-mailadres in."
            }}
            placeholder="Vul een volledig e-mailadres of organisatienaam in"
            allowValuesOutsideList={true}
            disabled={isSubmitting}
            form={form} // Pass the form instance
            name="username" // Name for remix-hook-form registration
          />
          <div className="flex items-center justify-end space-x-2">
            <Select
              defaultValue={form.getValues("role")}
              name="role"
              onValueChange={(value) =>
                form.setValue("role", value as "owner" | "advisor" | "researcher")
              }
            >
              <SelectTrigger className="ml-auto w-[150px]">
                <SelectValue placeholder="Selecteer rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Eigenaar</SelectItem>
                <SelectItem value="advisor">Adviseur</SelectItem>
                <SelectItem value="researcher">Onderzoeker</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="default"
              className="shrink-0"
              name="intent" // Ensure intent is part of submission
              value="invite_user"
              type="submit"
            >
              {isSubmitting ? (
                <span key="submitting" className="sr-only">
                  <Spinner /> Uitnodigen
                </span>
              ) : (
                <span key="idle">Uitnodigen</span>
              )}
            </Button>
          </div>
        </fieldset>
        <p className="text-muted-foreground text-sm">
          Personen voeg je toe met hun volledige e-mailadres, bijvoorbeeld naam@bedrijf.nl.
          Organisaties kun je op naam zoeken.
        </p>
      </Form>
    </RemixFormProvider>
  )
}
