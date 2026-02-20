import { zodResolver } from "@hookform/resolvers/zod"
import { User, Users } from "lucide-react"
import { useState } from "react"
import { Form } from "react-router-dom"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import isEmail from "validator/lib/isEmail"
import type { z } from "zod"
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
    displayUserName: string
    image?: string
    initials: string
    role: "owner" | "advisor" | "researcher"
    type: "user" | "organization"
}

type InvitationFormProps = {
    principals: Principal[]
}

export const InvitationForm = ({ principals }: InvitationFormProps) => {
    const [selectedValue, setSelectedValue] = useState<string>("")
    const form = useRemixForm<z.infer<typeof AccessFormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(AccessFormSchema),
        defaultValues: {
            role: "advisor", // Set default role
            intent: "invite_user",
        },
    })

    // Define icon map for AutoComplete
    const iconMap = { user: User, organization: Users }

    return (
        <RemixFormProvider {...form}>
            <Form method="post">
                <fieldset
                    disabled={form.formState.isSubmitting}
                    className="flex items-center justify-between space-x-4"
                >
                    <AutoComplete
                        className="flex-1"
                        lookupUrl="/api/lookup/principal"
                        excludeValues={principals.map((p) => p.username)}
                        iconMap={iconMap}
                        selectedValue={selectedValue}
                        onSelectedValueChange={(value) => {
                            setSelectedValue(value)
                            // Update form value when selected
                            form.setValue("username", value, {
                                shouldTouch: true,
                            })
                        }}
                        emptyMessage={(value) =>
                            isEmail(value)
                                ? `Nodig ${value} uit voor toegang`
                                : "Geen gebruikers gevonden"
                        }
                        placeholder="Zoek naar een gebruiker of organisatie"
                        allowValuesOutsideList={true}
                        form={form} // Pass the form instance
                        name="username" // Name for remix-hook-form registration
                    />
                    <div className="flex items-center space-x-2 justify-end">
                        <Select
                            defaultValue={form.getValues("role")}
                            name="role"
                            onValueChange={(value) =>
                                form.setValue(
                                    "role",
                                    value as "owner" | "advisor" | "researcher",
                                )
                            }
                        >
                            <SelectTrigger className="ml-auto w-[150px]">
                                <SelectValue placeholder="Selecteer rol" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="owner">Eigenaar</SelectItem>
                                <SelectItem value="advisor">
                                    Adviseur
                                </SelectItem>
                                <SelectItem value="researcher">
                                    Onderzoeker
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="default"
                            className="shrink-0"
                            name="intent" // Ensure intent is part of submission
                            value="invite_user"
                            type="submit"
                        >
                            {form.formState.isSubmitting ? (
                                <Spinner />
                            ) : (
                                "Uitnodigen"
                            )}
                        </Button>
                    </div>
                </fieldset>
            </Form>
        </RemixFormProvider>
    )
}
