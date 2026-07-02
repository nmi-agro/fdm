import type z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { EmailBlock } from "@nmi-agro/fdm-helpdesk"
import fuzzysort from "fuzzysort"
import { MailX, User, Users } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { Controller } from "react-hook-form"
import { Form, useFetcher, useNavigation } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { cn } from "@/app/lib/utils"
import { AutoComplete } from "~/components/custom/autocomplete"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Field, FieldContent, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { AddBlockedEmailSchema } from "./blocked-email-schema"

export type EmailBlockExtended = EmailBlock & { blocked_by_name: string | null }
export interface HelpdeskAgentManagerProps {
  blockedEmails: EmailBlockExtended[]
  canModify: boolean
}

export function BlockedEmailsManager({ blockedEmails, canModify }: HelpdeskAgentManagerProps) {
  const [searchTerms, setSearchTerms] = useState("")

  const searchTargets = useMemo(
    () => blockedEmails.map((item, i) => `[${i}] ${item.email} ${item.reason}`.toLowerCase()),
    [blockedEmails],
  )
  const searchResults = useMemo(() => {
    if (searchTerms.trim().length === 0) return blockedEmails
    const results = fuzzysort.go(searchTerms.toLowerCase(), searchTargets, { threshold: -10000 })
    return results
      .map((r) => {
        const match = r.target.match(/^\[(\d+)\]/)
        if (!match) return null
        return blockedEmails[Number(match[1])] ?? null
      })
      .filter((item): item is EmailBlockExtended => item !== null)
  }, [blockedEmails, searchTargets, searchTerms])

  return (
    <Card className="mx-auto max-w-5xl">
      {canModify && (
        <CardHeader className="mx-2 flex flex-row items-center justify-between gap-4">
          <Input
            value={searchTerms}
            onChange={(e) => setSearchTerms(e.currentTarget.value)}
            placeholder="Zoek naar een blok..."
            className="my-0 max-w-lg"
          />
          <AddBlockedEmailForm />
        </CardHeader>
      )}
      <CardContent className="first:pt-6">
        {searchResults.length > 0 ? (
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>E-mailadres</TableHead>
                <TableHead>Geblokkeerd door</TableHead>
                <TableHead>Oorzaak</TableHead>
                {canModify ? (
                  <>
                    <TableHead />
                    <TableHead />
                  </>
                ) : undefined}
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((block) => (
                <BlockedEmailRow key={block.email} emailBlock={block} canModify={canModify} />
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty className="border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MailX />
              </EmptyMedia>
              <EmptyTitle>
                {blockedEmails.length === 0
                  ? "Jullie hebben nog geen e-mailadressen geblokkeerd."
                  : "Geen resultaten."}
              </EmptyTitle>
              <EmptyDescription>
                Voeg een geblokkeerd e-mailadres toe om te voorkomen dat u daarvan e-mails ontvangt.
              </EmptyDescription>
            </EmptyHeader>
            {canModify && (
              <EmptyContent>
                <AddBlockedEmailForm />
              </EmptyContent>
            )}
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}

export function AddBlockedEmailForm() {
  const navigation = useNavigation()
  const isSubmitting = navigation.state !== "idle"
  const [open, setOpen] = useState(false)

  const form = useRemixForm<z.infer<typeof AddBlockedEmailSchema>>({
    mode: "onSubmit",
    resolver: zodResolver(AddBlockedEmailSchema),
    defaultValues: {
      intent: "add_email_block",
    },
  })

  // Close the form when submission succeeds
  useEffect(() => {
    if (form.formState.isSubmitted && form.formState.isSubmitSuccessful) {
      setOpen(false)
    }
  }, [form.formState.isSubmitted, form.formState.isSubmitSuccessful])

  // Define icon map for AutoComplete
  const iconMap = { user: User, organization: Users }

  const reasonId = useId()

  function resetForm() {
    form.reset({
      intent: "add_email_block",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={resetForm}>
        <Button>Nieuw toevoegen</Button>
      </DialogTrigger>
      <DialogContent>
        <RemixFormProvider {...form}>
          <Form method="post" className="space-y-6" onSubmit={form.handleSubmit}>
            <DialogHeader>
              <DialogTitle>Nieuw geblokkeerd e-mailadres toevoegen</DialogTitle>
            </DialogHeader>
            <fieldset disabled={isSubmitting} className="space-y-4">
              {/* For uncontrolled form - intent is injected in Javascript in submitHandlers, see above. */}
              <input type="hidden" name="intent" value="add_email_block" />
              <Controller
                name="email"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>E-mailadres of gebruiker</FieldLabel>
                    <FieldContent>
                      <AutoComplete
                        lookupUrl="/api/lookup/principal?email"
                        iconMap={iconMap}
                        selectedValue={field.value}
                        onSelectedValueChange={(value) => form.setValue(field.name, value)}
                        emptyMessage="Geen gebruikers gevonden."
                        placeholder="Vul eeen e-mailadres in of zoek naar een gebruiker of organisatie"
                        allowValuesOutsideList={true}
                        disabled={isSubmitting}
                        form={form} // Pass the form instance
                        name={field.name} // Name for remix-hook-form registration
                      />
                    </FieldContent>
                    {fieldState.error ? <FieldError errors={[fieldState.error]} /> : undefined}
                  </Field>
                )}
              />
              <Controller
                name="reason"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={reasonId}>Oorzaak (optioneel)</FieldLabel>
                    <FieldContent>
                      <Input {...field} id={reasonId} />
                    </FieldContent>
                    {fieldState.error ? <FieldError errors={[fieldState.error]} /> : undefined}
                  </Field>
                )}
              />
            </fieldset>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Sluiten
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                Toevoegen{isSubmitting && <Spinner />}
              </Button>
            </DialogFooter>
          </Form>
        </RemixFormProvider>
      </DialogContent>
    </Dialog>
  )
}

export interface BlockedEmailRowProps {
  emailBlock: EmailBlockExtended
  canModify: boolean
}

export function BlockedEmailRow({ emailBlock, canModify }: BlockedEmailRowProps) {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== "idle"

  return (
    <TableRow>
      <TableCell className="align-middle">{emailBlock.email}</TableCell>
      <TableCell className="align-middle">{emailBlock.blocked_by_name}</TableCell>
      <TableCell className="align-middle" width="40%">
        {emailBlock.reason}
      </TableCell>
      {canModify ? (
        <>
          <TableCell>
            <Spinner className={cn(fetcher.state === "idle" && "invisible")} />
          </TableCell>
          <TableCell className="text-end align-middle">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const formData = new FormData()
                formData.append("intent", "remove_email_block")
                formData.append("email", emailBlock.email)
                void fetcher.submit(formData, { method: "post" })
              }}
              disabled={isSubmitting}
            >
              Verwijderen
            </Button>
          </TableCell>
        </>
      ) : undefined}
    </TableRow>
  )
}
