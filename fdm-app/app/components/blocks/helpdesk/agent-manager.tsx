import { zodResolver } from "@hookform/resolvers/zod"
import { User, Users } from "lucide-react"
import type { ComponentProps } from "react"
import { Controller } from "react-hook-form"
import { Form, useFetcher, useNavigation, useSubmit } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type z from "zod"
import { cn } from "@/app/lib/utils"
import { AutoComplete } from "~/components/custom/autocomplete"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Field, FieldContent } from "~/components/ui/field"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Table, TableBody, TableCell, TableRow } from "~/components/ui/table"
import { AddAgentSchema } from "./agent-schema"
import type { HelpdeskUser } from "./types"

export type RoleDescription = { name: string; label: string }

export type HelpdeskUserExtended = HelpdeskUser & {
    role: string
    isInvitation: boolean
    isActive: boolean
}

export const agentRoles: RoleDescription[] = [
    { name: "agent", label: "Medewerker" },
    { name: "admin", label: "Beheerder" },
]

export interface HelpdeskAgentManagerProps {
    helpdeskUsers: HelpdeskUserExtended[]
    roles: RoleDescription[]
    canModify: boolean
}

export function HelpdeskAgentManager({
    helpdeskUsers,
    roles,
    canModify,
}: HelpdeskAgentManagerProps) {
    return (
        <Card className="mx-auto max-w-5xl">
            {canModify && (
                <CardHeader>
                    <AddAgentForm helpdeskUsers={helpdeskUsers} roles={roles} />
                </CardHeader>
            )}
            <CardContent className="first:pt-6">
                <Table className="w-full">
                    <TableBody>
                        {helpdeskUsers.map((principal) => (
                            <PrincipalRow
                                key={principal.principal_id}
                                principal={principal}
                                roles={roles}
                                canModify={canModify}
                            />
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

export interface AddAgentFormProps {
    helpdeskUsers: HelpdeskUser[]
    roles: RoleDescription[]
}

export function AddAgentForm({ helpdeskUsers, roles }: AddAgentFormProps) {
    const navigation = useNavigation()
    const isSubmitting = navigation.state !== "idle"

    const submit = useSubmit()

    const defaultRole = roles[0].name
    const form = useRemixForm<z.infer<typeof AddAgentSchema>>({
        mode: "onSubmit",
        resolver: zodResolver(AddAgentSchema),
        defaultValues: {
            role: defaultRole,
        },
        submitHandlers: {
            onValid: (values) => {
                submit(
                    {
                        ...values,
                        intent: "add_agent",
                    },
                    { method: "post" },
                )
            },
        },
    })

    // Define icon map for AutoComplete
    const iconMap = { user: User, organization: Users }

    return (
        <RemixFormProvider {...form}>
            <Form method="post" onSubmit={form.handleSubmit}>
                <fieldset
                    disabled={isSubmitting}
                    className="flex items-center justify-between space-x-4"
                >
                    {/* For uncontrolled form - intent is injected in Javascript in submitHandlers, see above. */}
                    <input type="hidden" name="intent" value="add_agent" />
                    <Controller
                        name="username"
                        render={({ field }) => (
                            <Field className="grow">
                                <FieldContent>
                                    <AutoComplete
                                        lookupUrl="/api/lookup/principal?principal_id"
                                        excludeValues={helpdeskUsers.map(
                                            (p) => p.principal_id,
                                        )}
                                        iconMap={iconMap}
                                        selectedValue={field.value}
                                        onSelectedValueChange={(value) =>
                                            form.setValue("principal_id", value)
                                        }
                                        emptyMessage="Geen gebruikers gevonden."
                                        placeholder="Zoek naar een gebruiker of organisatie"
                                        allowValuesOutsideList={false}
                                        disabled={isSubmitting}
                                        form={form} // Pass the form instance
                                        name={field.name} // Name for remix-hook-form registration
                                    />
                                </FieldContent>
                            </Field>
                        )}
                    />
                    <Controller
                        name="role"
                        render={() => (
                            <Field className="max-w-50">
                                <FieldContent>
                                    <RoleSelect
                                        defaultValue={defaultRole}
                                        onValueChange={(value) =>
                                            form.setValue("role", value)
                                        }
                                        roles={roles}
                                    />
                                </FieldContent>
                            </Field>
                        )}
                    />
                    <Button type="submit" disabled={isSubmitting}>
                        Toevoegen{isSubmitting && <Spinner />}
                    </Button>
                </fieldset>
            </Form>
        </RemixFormProvider>
    )
}

export interface PrincipalRow {
    principal: HelpdeskUserExtended
    roles: RoleDescription[]
    canModify: boolean
}

export function PrincipalRow({ principal, roles, canModify }: PrincipalRow) {
    const fetcher = useFetcher()
    const isSubmitting = fetcher.state !== "idle"

    return (
        <TableRow>
            <TableCell className="align-middle">
                <Avatar>
                    <AvatarImage src={principal.image ?? undefined} />
                    <AvatarFallback>{principal.initials}</AvatarFallback>
                </Avatar>
            </TableCell>
            <TableCell className="align-middle" width="99%">
                {principal.displayUserName}
            </TableCell>
            {canModify ? (
                <>
                    <TableCell>
                        <Spinner
                            className={cn(
                                fetcher.state === "idle" && "invisible",
                            )}
                        />
                    </TableCell>
                    <TableCell className="align-middle">
                        {principal.isActive ? (
                            <RoleSelect
                                roles={roles}
                                value={principal.role}
                                onValueChange={(value) => {
                                    const formData = new FormData()
                                    formData.append(
                                        "intent",
                                        "update_agent_role",
                                    )
                                    formData.append(
                                        "principal_id",
                                        principal.principal_id,
                                    )
                                    formData.append("role", value)
                                    fetcher.submit(formData, { method: "post" })
                                }}
                                disabled={isSubmitting}
                            />
                        ) : (
                            <i className="italic text-muted-foreground">
                                niet actief
                            </i>
                        )}
                    </TableCell>
                    <TableCell className="text-end align-middle">
                        <Button
                            type="button"
                            variant={
                                principal.isActive ? "destructive" : "outline"
                            }
                            onClick={() => {
                                const formData = new FormData()
                                formData.append(
                                    "intent",
                                    "set_agent_active_status",
                                )
                                formData.append(
                                    "principal_id",
                                    principal.principal_id,
                                )
                                formData.append(
                                    "is_active",
                                    principal.isActive ? "false" : "true",
                                )
                                fetcher.submit(formData, { method: "post" })
                            }}
                            disabled={isSubmitting}
                        >
                            {principal.isActive ? "Ontslaan" : "Maak actief"}
                        </Button>
                    </TableCell>
                </>
            ) : (
                <TableCell>
                    {roles.find((role) => role.name === principal.role)
                        ?.label ?? "Gebruiker"}
                </TableCell>
            )}
        </TableRow>
    )
}

function RoleSelect(
    props: ComponentProps<typeof Select> & { roles: RoleDescription[] },
) {
    const { roles, ...selectProps } = props
    return (
        <Select {...selectProps}>
            <SelectTrigger className="min-w-50">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {roles.map((item) => (
                    <SelectItem key={item.name} value={item.name}>
                        {item.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
