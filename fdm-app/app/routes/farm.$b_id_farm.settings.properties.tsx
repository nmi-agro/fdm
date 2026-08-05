import type { Control, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  checkPermission,
  getFarm,
  revokeFarmVerificationStatus,
  updateFarm,
} from "@nmi-agro/fdm-core"
import { useEffect } from "react"
import {
  type ActionFunctionArgs,
  data,
  Form,
  type LoaderFunctionArgs,
  type MetaFunction,
  useFetcher,
  useLoaderData,
} from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { dataWithSuccess } from "remix-toast"
import validator from "validator"
import { z } from "zod"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { getFarmVerificationStatus } from "~/lib/farm-verification.server"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { cn } from "~/lib/utils"

const { isPostalCode } = validator

import { clientConfig } from "~/lib/config"

// Meta
export const meta: MetaFunction = () => {
  return [
    {
      title: `Eigenschappen - Instellingen - Bedrijf | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk en bewerk de eigenschappen van je bedrijf.",
    },
  ]
}

/**
 * Retrieves the details of a farm using the farm ID from the URL parameters and the user's session.
 *
 * This function validates that a farm ID is provided and obtains the current session to fetch the
 * corresponding farm details. It throws an error with a 400 status if the farm ID is missing and a 404
 * status if no matching farm is found.
 *
 * @returns An object containing the farm details under the `farm` property.
 * @throws {Response} If the farm ID is missing or if the farm could not be found.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // Get the farm id
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", {
        status: 400,
        statusText: "Farm ID is required",
      })
    }

    // Get the session
    const session = await getSession(request)

    // Get details of farm
    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
    if (!farm) {
      throw data("Farm is not found", {
        status: 404,
        statusText: "Farm is not found",
      })
    }
    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )
    const farmVerification = await getFarmVerificationStatus(fdm, session.principal_id, b_id_farm)

    // Return user information from loader
    return {
      farm: farm,
      farmWritePermission: farmWritePermission,
      farmVerification,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Renders a form for updating farm properties.
 *
 * This component initializes a form using data loaded from the route loader and sets default values for fields such as company name (required), business ID, address, and postal code. It leverages validation with a Zod schema and automatically resets form data when the loader data changes. Upon submission, the form sends a POST request to update the farm settings.
 */
type FormValues = z.infer<typeof FormSchema>

export default function FarmSettingsPropertiesBlock() {
  const loaderData = useLoaderData<typeof loader>()
  const unlockFetcher = useFetcher()

  const form = useRemixForm<FormValues>({
    mode: "onTouched",
    resolver: zodResolver(FormSchema) as Resolver<FormValues>,
    defaultValues: {
      b_name_farm: loaderData.farm.b_name_farm ?? "",
      b_businessid_farm: loaderData.farm.b_businessid_farm ?? "",
      b_address_farm: loaderData.farm.b_address_farm ?? "",
      b_postalcode_farm: loaderData.farm.b_postalcode_farm ?? "",
    },
  })

  useEffect(() => {
    form.reset({
      b_name_farm: loaderData.farm.b_name_farm ?? "",
      b_businessid_farm: loaderData.farm.b_businessid_farm ?? "",
      b_address_farm: loaderData.farm.b_address_farm ?? "",
      b_postalcode_farm: loaderData.farm.b_postalcode_farm ?? "",
    })
  }, [loaderData, form.reset])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Gegevens</h3>
        <p className="text-muted-foreground text-sm">Werk de gegevens bij van dit bedrijf</p>
      </div>
      <Separator />
      <RemixFormProvider {...form}>
        <Form id="formFarmProperties" onSubmit={form.handleSubmit} method="post">
          <fieldset disabled={!loaderData.farmWritePermission || form.formState.isSubmitting}>
            <div className="grid w-full grid-cols-2 items-center gap-4">
              <div className="col-span-2 flex flex-col space-y-1.5">
                <FormField
                  control={form.control as unknown as Control<any, any, any>}
                  name="b_name_farm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bedrijfsnaam</FormLabel>
                      <FormControl>
                        <Input placeholder="bv. De Vries V.O.F." {...field} required />
                      </FormControl>
                      <FormDescription />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-1 flex flex-col space-y-1.5">
                <FormField
                  control={form.control as unknown as Control<any, any, any>}
                  name="b_businessid_farm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kvk nummer</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="bv. 91021934"
                          {...field}
                          disabled={loaderData.farmVerification.isVerified}
                        />
                      </FormControl>
                      <FormDescription>
                        {loaderData.farmVerification.isVerified ? (
                          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            Het KvK-nummer is vergrendeld omdat dit bedrijf hierop is geverifieerd.
                            Wijzig het nummer alleen als het onjuist is.
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  type="button"
                                  variant="link"
                                  className="h-auto p-0 text-xs"
                                  disabled={!loaderData.farmWritePermission}
                                >
                                  KvK-nummer corrigeren?
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>KvK-nummer wijzigen?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Dit bedrijf is geverifieerd op basis van het huidige
                                    KvK-nummer. Als u het nummer wijzigt, vervalt de geverifieerde
                                    status en moet dit bedrijf opnieuw geverifieerd worden via RVO
                                    met eHerkenning.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      unlockFetcher.submit(
                                        { intent: "unlock_kvk" },
                                        { method: "post" },
                                      )
                                    }
                                  >
                                    KvK-nummer ontgrendelen
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </span>
                        ) : (
                          "Het Kamer van Koophandel nummer waarmee dit bedrijf is ingeschreven"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-2 flex flex-col space-y-1.5">
                <FormField
                  control={form.control as unknown as Control<any, any, any>}
                  name="b_address_farm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adres</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="bv. Nieuwe Kanaal 7 
Wageningen"
                          className="resize-none"
                          autoComplete="address"
                          rows={3}
                          maxLength={300}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-1 flex flex-col space-y-1.5">
                <FormField
                  control={form.control as unknown as Control<any, any, any>}
                  name="b_postalcode_farm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="bv. 1234 AB"
                          {...field}
                          autoComplete="postal-code"
                          maxLength={7}
                        />
                      </FormControl>
                      <FormDescription />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </fieldset>
          <br />
          <div className="ml-auto">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className={cn("m-auto", cn(!loaderData.farmWritePermission ? "invisible" : ""))}
            >
              {form.formState.isSubmitting && <Spinner />}
              Bijwerken
            </Button>
          </div>
        </Form>
      </RemixFormProvider>
    </div>
  )
}

/**
 * Updates farm settings using values submitted from a form.
 *
 * This function extracts the farm ID from URL parameters and retrieves the user session
 * from the request. It then parses and validates form data based on a predefined schema, and
 * updates the corresponding farm record with the provided values. On successful update, it returns
 * a response containing a success message.
 *
 * @throws {Error} If the farm ID is missing or if an error occurs during the update process.
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm

    if (!b_id_farm) {
      throw new Error("missing: b_id_farm")
    }

    // Get the session
    const session = await getSession(request)

    // Peek at the intent without consuming the request body, so the main
    // update flow below can still read the full form via extractFormValuesFromRequest.
    const intentFormData = await request.clone().formData()
    if (intentFormData.get("intent") === "unlock_kvk") {
      await revokeFarmVerificationStatus(fdm, session.principal_id, b_id_farm)
      return dataWithSuccess(null, {
        message: "Verificatie ingetrokken. Het KvK-nummer is nu aanpasbaar.",
      })
    }

    const formValues = await extractFormValuesFromRequest(request, FormSchema)

    // Remove new lines in address
    const b_address_farm = formValues.b_address_farm?.replace(/\\n/g, " ")

    await updateFarm(
      fdm,
      session.principal_id,
      b_id_farm,
      formValues.b_name_farm,
      formValues.b_businessid_farm,
      b_address_farm,
      formValues.b_postalcode_farm,
    )

    return dataWithSuccess("farm is updated", {
      message: `${formValues.b_name_farm} is bijgewerkt! 🎉`,
    })
  } catch (error) {
    return handleActionError(error)
  }
}

// Form Schema
const FormSchema = z.object({
  b_name_farm: z.string().trim().min(3, {
    error: "Naam van bedrijf moet minimaal 3 karakters bevatten",
  }),
  b_businessid_farm: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{8}$/.test(value), {
      error: "KvK-nummer moet uit 8 cijfers bestaan",
    }),
  b_address_farm: z.string().optional(),
  b_postalcode_farm: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isPostalCode(value, "NL"), {
      error: "Ongeldige postcode",
    }),
})
