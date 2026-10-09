import type { ZodError } from "zod"
import {
  addFarmVerification,
  addSoilAnalysis,
  type FdmType,
  type Field,
  type FieldGeometry,
  getCultivations,
  getCultivationsFromCatalogue,
  getFarm,
  getFarms,
  getFields,
} from "@nmi-agro/fdm-core"
import {
  type ImportReviewAction,
  type RvoImportReviewItem,
  RvoImportReviewStatus,
  type UserChoiceMap,
} from "@nmi-agro/fdm-rvo/types"
import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useSearchParams,
  useNavigation,
  useParams,
} from "react-router"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { parseRvoRequestMode, RvoConnectCard } from "~/components/blocks/rvo/connect-card"
import { RvoErrorAlert } from "~/components/blocks/rvo/error-alert"
import { RvoImportReviewTable } from "~/components/blocks/rvo/import-review-table"
import { RvoNoFieldsAlert } from "~/components/blocks/rvo/no-fields-alert"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { SidebarInset } from "~/components/ui/sidebar"
import { getNmiApiKey, getSoilParameterEstimatesForGeometry } from "~/integrations/nmi.server"
import {
  createConfiguredRvoClient,
  createRvoState,
  getRvoCredentials,
  getRvoPermissionDeniedMessage,
  parseRvoToken,
  type RvoRequestMode,
  RvoRequestModeSchema,
  rvoTokenCookie,
} from "~/integrations/rvo.server"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { extractErrorMessage } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  compareFields,
  fetchRvoFields,
  generateAuthUrl,
  getRvoErrorDetails,
  isRvoPermissionDeniedError,
  processRvoImport,
} from "~/lib/rvo.server"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.rvo"

type ReviewItem = RvoImportReviewItem<Field>

export const meta: Route.MetaFunction = ({ params }) => {
  return [{ title: `Percelen ophalen bij RVO - Bedrijf ${params.b_id_farm}` }]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { b_id_farm, calendar: yearString } = params
  if (!b_id_farm) {
    throw new Response("Farm ID is required", { status: 400 })
  }
  const year = Number(yearString)
  if (!Number.isInteger(year)) {
    throw new Response("Ongeldig kalenderjaar", { status: 400 })
  }

  const session = await getSession(request)
  const url = new URL(request.url)
  const rvoToken = await parseRvoToken(request.headers.get("Cookie"))

  let rvoImportReviewData: ReviewItem[] = []
  let error: string | null = null
  // Set once an RVO token is present: whose data was requested, and whether RVO denied it
  let rvoMode: RvoRequestMode | null = null
  let accessDenied = false
  let b_businessid_farm: string | null = null
  let b_name_farm: string | null = null

  // Check if RVO is configured
  const rvoCredentials = getRvoCredentials()
  const isRvoConfigured = rvoCredentials !== undefined

  const farm = await getFarm(fdm, session.principal_id, b_id_farm)
  if (farm) {
    b_businessid_farm = farm.b_businessid_farm
    b_name_farm = farm.b_name_farm
  }

  const farms = await getFarms(fdm, session.principal_id)

  // rvo_token cookie is set by /callback/rvo after a successful token exchange
  if (rvoToken) {
    const rvoAccessToken = rvoToken.accessToken
    rvoMode = rvoToken.mode
    try {
      if (!isRvoConfigured) {
        throw new Response("RVO client is not configured.", {
          status: 500,
        })
      }

      if (!farm?.b_businessid_farm) {
        throw new Response("b_businessid_farm is not available", {
          status: 400,
        })
      }

      const rvoClient = createConfiguredRvoClient(rvoCredentials)
      rvoClient.setAccessToken(rvoAccessToken)

      // Capture an event when the fields are about to be requested from RVO
      captureEvent(session.principal_id, "fields_requested_rvo", {
        b_id_farm,
        calendar: yearString,
        rvo_mode: rvoMode,
      })

      let rvoFields: Awaited<ReturnType<typeof fetchRvoFields>>
      try {
        // Only send the KvK number (as ThirdPartyFarmID) when requesting data on behalf of
        // another farm. For the own farm, RVO derives the farm from the eHerkenning identity.
        rvoFields = await fetchRvoFields(
          rvoClient,
          yearString,
          rvoMode === "machtiging" ? farm.b_businessid_farm : undefined,
        )
      } catch (fetchError) {
        const { status_code, edi_code, message } = getRvoErrorDetails(fetchError)
        const reason: unknown =
          (fetchError as ZodError)?.name === "ZodError"
            ? { ZodError: (fetchError as ZodError)?.issues }
            : message
        captureEvent(session.principal_id, "fields_requested_rvo_failed", {
          b_id_farm,
          calendar: yearString,
          rvo_mode: rvoMode,
          reason,
          status_code,
          edi_code,
        })
        if (isRvoPermissionDeniedError(fetchError)) {
          // With a machtiging, RVO checked the machtiging against the KvK number we sent and
          // denied it: a definitive negative result, not a system fault, so it's worth
          // recording. For the own farm, no KvK number was sent, so nothing was verified.
          if (rvoMode === "machtiging") {
            await addFarmVerification(fdm, session.principal_id, b_id_farm, {
              verification_method: "rvo_eherkenning",
              verification_result: "not_verified",
              b_businessid_farm: farm.b_businessid_farm,
            })
          }
          // Shown on this page, so the user can retry with the other option
          accessDenied = true
        }
        throw fetchError
      }

      // Capture an event once the fields are successfully received from RVO
      captureEvent(session.principal_id, "fields_requested_rvo_successful", {
        b_id_farm,
        rvo_field_count: rvoFields.length,
        calendar: yearString,
        rvo_mode: rvoMode,
      })

      // A successful machtiging request verifies the farm regardless of how many fields RVO
      // returns — zero fields is a valid state for a farm that has not yet registered any
      // percelen. An own-farm request does not verify the farm: RVO does not tell us which
      // KvK number the eHerkenning belongs to, so it does not prove the farm's KvK number.
      if (rvoMode === "machtiging") {
        await addFarmVerification(fdm, session.principal_id, b_id_farm, {
          verification_method: "rvo_eherkenning",
          verification_result: "verified",
          b_businessid_farm: farm.b_businessid_farm,
        })
      }

      const localFields = await getFields(fdm, session.principal_id, b_id_farm)
      const localFieldsExtended = await Promise.all(
        localFields.map(async (field) => {
          const cultivations = await getCultivations(fdm, session.principal_id, field.b_id, {
            start: new Date(`${yearString}-01-01`),
            end: new Date(`${yearString}-12-31`),
          })
          return { ...field, cultivations }
        }),
      )

      const cultivationsCatalogue = await getCultivationsFromCatalogue(
        fdm,
        session.principal_id,
        b_id_farm,
      )

      rvoImportReviewData = compareFields(
        localFieldsExtended,
        rvoFields,
        year,
        cultivationsCatalogue,
      )
    } catch (e) {
      console.error("Error with importing from RVO:", e)
      if (accessDenied) {
        error = getRvoPermissionDeniedMessage(rvoToken.mode, farm?.b_name_farm)
      } else {
        if (e instanceof Response && e.status === 403) {
          throw e
        }
        error = await extractErrorMessage(e)
      }
    }
  } else if (!url.searchParams.has("start_import")) {
    const clearedTokenCookie = await rvoTokenCookie.serialize("", {
      maxAge: 0,
    })
    return data(
      {
        b_id_farm,
        rvoImportReviewData: [],
        error: null,
        showimportButton: true,
        noRvoFieldsFound: false,
        b_businessid_farm,
        isRvoConfigured,
        rvoMode,
        accessDenied,
        farms,
        b_name_farm,
        calendar: yearString,
      },
      { headers: { "Set-Cookie": clearedTokenCookie } },
    )
  }

  const clearedTokenCookie = await rvoTokenCookie.serialize("", { maxAge: 0 })
  const noRvoFieldsFound = !error && rvoImportReviewData.length === 0
  return data(
    {
      b_id_farm,
      rvoImportReviewData,
      error,
      showimportButton: noRvoFieldsFound,
      noRvoFieldsFound,
      b_businessid_farm,
      isRvoConfigured,
      rvoMode,
      accessDenied,
      farms,
      b_name_farm,
      calendar: yearString,
    },
    { headers: { "Set-Cookie": clearedTokenCookie } },
  )
}

export default function RvoImportReviewPage() {
  const { b_id_farm = "" } = useParams()
  const {
    rvoImportReviewData,
    error,
    b_businessid_farm,
    isRvoConfigured,
    rvoMode,
    accessDenied,
    farms,
    calendar,
    showimportButton,
    noRvoFieldsFound,
  } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const isImporting =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "start_import"
  const isApplying =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "apply_changes"

  const [userChoices, setUserChoices] = useState<UserChoiceMap>({})

  useEffect(() => {
    const initialChoices: UserChoiceMap = {}
    rvoImportReviewData.forEach((item) => {
      const id = getItemId(item)
      let defaultAction: ImportReviewAction

      switch (item.status) {
        case RvoImportReviewStatus.NEW_REMOTE:
          defaultAction = "ADD_REMOTE"
          break
        case RvoImportReviewStatus.NEW_LOCAL:
          defaultAction = "REMOVE_LOCAL"
          break
        case RvoImportReviewStatus.EXPIRED_LOCAL:
          defaultAction = "CLOSE_LOCAL"
          break
        case RvoImportReviewStatus.CONFLICT:
          defaultAction = "UPDATE_FROM_REMOTE"
          break
        case RvoImportReviewStatus.MATCH:
          defaultAction = "NO_ACTION"
          break
      }
      initialChoices[id] = defaultAction
    })
    setUserChoices(initialChoices)
  }, [rvoImportReviewData])

  // Warn the user before refreshing or leaving when data is present
  useEffect(() => {
    if (rvoImportReviewData.length > 0) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue =
          "Als u de pagina ververst, wordt de verbinding met RVO verbroken en moet u opnieuw inloggen met eHerkenning. Wilt u doorgaan?"
        return e.returnValue
      }
      window.addEventListener("beforeunload", handleBeforeUnload)
      return () => window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [rvoImportReviewData])

  const handleChoiceChange = (id: string, action: ImportReviewAction) => {
    setUserChoices((prev: UserChoiceMap) => ({ ...prev, [id]: action }))
  }

  const currentFarmName = farms.find((farm) => farm.b_id_farm === b_id_farm)?.b_name_farm ?? ""

  const changes = Object.values(userChoices).reduce(
    (acc, action) => {
      if (action === "ADD_REMOTE") acc.add++
      if (action === "REMOVE_LOCAL") acc.remove++
      if (action === "UPDATE_FROM_REMOTE") acc.update++
      if (action === "CLOSE_LOCAL") acc.close++
      return acc
    },
    { add: 0, remove: 0, update: 0, close: 0 },
  )
  const hasChanges = Object.values(changes).some((count) => count > 0)

  if (error) {
    return (
      <SidebarInset>
        <Header
          action={{
            to: `/farm/${b_id_farm}`,
            label: "Terug naar bedrijf",
            disabled: false,
          }}
        >
          <HeaderFarm b_id_farm={b_id_farm} farmOptions={farms} />
          <BreadcrumbSeparator />
          <BreadcrumbItem className="hidden md:block">Percelen ophalen bij RVO</BreadcrumbItem>
        </Header>
        <main>
          <div className="flex items-center justify-between">
            <FarmTitle
              title={accessDenied ? "Geen toegang bij RVO" : "Fout bij ophalen percelen bij RVO"}
              description={
                accessDenied
                  ? "RVO heeft de aanvraag voor dit bedrijf geweigerd."
                  : "Er is iets misgegaan bij het ophalen van gegevens."
              }
            />
          </div>
          <FarmContent>
            <div className="flex flex-col space-y-8 pb-10 lg:flex-row lg:space-y-0 lg:space-x-12">
              <div className="w-full">
                <RvoErrorAlert
                  error={error}
                  accessDenied={accessDenied}
                  retryPath={
                    accessDenied && rvoMode
                      ? // Offer the other option, as a wrong choice is the most likely cause
                        `${location.pathname}?rvo_mode=${rvoMode === "own_farm" ? "machtiging" : "own_farm"}`
                      : location.pathname
                  }
                  retryLabel={accessDenied ? "Opnieuw verbinden" : undefined}
                />
              </div>
            </div>
          </FarmContent>
        </main>
      </SidebarInset>
    )
  }

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${b_id_farm}`,
          label: "Terug naar bedrijf",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farms} />
        <BreadcrumbSeparator />
        <BreadcrumbItem className="hidden md:block">Percelen ophalen bij RVO</BreadcrumbItem>
      </Header>
      <main>
        {actionData?.message && (
          <div className="p-6">
            <Alert variant={actionData.success ? "default" : "destructive"}>
              <AlertTitle>{actionData.success ? "Succes" : "Fout"}</AlertTitle>
              <AlertDescription>{actionData.message}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Config Warning */}
        {!isRvoConfigured && (
          <div className="p-6">
            <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
              <AlertTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Percelen ophalen bij RVO is niet beschikbaar
              </AlertTitle>
              <AlertDescription>
                De RVO koppeling is nog niet ingesteld op deze server. Neem contact op met de
                beheerder om de RVO credentials toe te voegen.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {rvoImportReviewData.length === 0 ? (
          <div className="mx-auto flex h-full w-full flex-col items-center justify-center space-y-6 py-10 sm:w-[600px]">
            {noRvoFieldsFound && (
              <RvoNoFieldsAlert mode={rvoMode} calendar={calendar} farmName={currentFarmName} />
            )}
            {showimportButton && (
              <RvoConnectCard
                b_name_farm={currentFarmName}
                b_businessid_farm={b_businessid_farm}
                calendar={calendar}
                kvkHref={`/farm/${b_id_farm}/settings/properties`}
                defaultMode={parseRvoRequestMode(searchParams.get("rvo_mode"))}
                isImporting={isImporting}
                isRvoConfigured={isRvoConfigured}
              />
            )}
          </div>
        ) : (
          <>
            <FarmTitle
              title={`Percelen opgehaald bij RVO voor ${currentFarmName}`}
              description={`Beoordeel de verschillen tussen de percelen in ${clientConfig.name} en bij RVO.`}
            />
            <FarmContent>
              <div className="flex flex-col space-y-4 pb-10">
                <div className="flex justify-end">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button disabled={isApplying}>
                        {isApplying ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verwerken...
                          </>
                        ) : hasChanges ? (
                          "Wijzigingen toepassen"
                        ) : (
                          "Doorgaan"
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Wijzigingen toepassen</DialogTitle>
                        <DialogDescription>
                          U staat op het punt de volgende wijzigingen door te voeren:
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <ul className="text-muted-foreground list-disc space-y-2 pl-6">
                          {changes.add > 0 && (
                            <li>
                              {changes.add} {changes.add === 1 ? "perceel" : "percelen"} toevoegen
                            </li>
                          )}
                          {changes.remove > 0 && (
                            <li>
                              {changes.remove} {changes.remove === 1 ? "perceel" : "percelen"}{" "}
                              verwijderen
                            </li>
                          )}
                          {changes.update > 0 && (
                            <li>
                              {changes.update} {changes.update === 1 ? "perceel" : "percelen"}{" "}
                              bijwerken
                            </li>
                          )}
                          {changes.close > 0 && (
                            <li>
                              {changes.close} {changes.close === 1 ? "perceel" : "percelen"}{" "}
                              afsluiten
                            </li>
                          )}
                        </ul>
                        {!hasChanges && <p>Geen wijzigingen geselecteerd.</p>}
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Annuleren</Button>
                        </DialogClose>
                        <Form method="post" action={`/farm/${b_id_farm}/${calendar}/rvo`}>
                          <input type="hidden" name="intent" value="apply_changes" />
                          <input
                            type="hidden"
                            name="userChoices"
                            value={JSON.stringify(userChoices)}
                          />
                          <input
                            type="hidden"
                            name="rvoImportReviewDataJson"
                            value={JSON.stringify(rvoImportReviewData)}
                          />
                          <Button type="submit" disabled={isApplying}>
                            Bevestigen
                          </Button>
                        </Form>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="w-full">
                  <RvoImportReviewTable
                    calendar={calendar}
                    data={rvoImportReviewData}
                    userChoices={userChoices}
                    onChoiceChange={handleChoiceChange}
                  />
                </div>
              </div>
            </FarmContent>
          </>
        )}
      </main>
    </SidebarInset>
  )
}

export async function action({ request, params, url }: Route.ActionArgs) {
  const { b_id_farm, calendar: yearString } = params
  if (!b_id_farm || !yearString) {
    throw data("Farm ID is required", {
      status: 400,
      statusText: "Farm ID is required",
    })
  }
  const year = Number(yearString)
  if (!Number.isInteger(year)) {
    throw data("Ongeldig kalenderjaar", {
      status: 400,
      statusText: "Ongeldig kalenderjaar",
    })
  }

  const session = await getSession(request)
  const formData = await request.formData()
  const intent = formData.get("intent")

  if (intent === "start_import") {
    const rvoCredentials = getRvoCredentials()
    const isRvoConfigured = rvoCredentials !== undefined

    if (!isRvoConfigured) {
      throw new Response("RVO client is not configured.", { status: 500 })
    }

    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
    if (!farm?.b_businessid_farm) {
      throw new Response("Geen KvK-nummer gevonden voor dit bedrijf.", {
        status: 400,
      })
    }

    const rvoMode = RvoRequestModeSchema.safeParse(formData.get("rvo_mode"))
    if (!rvoMode.success) {
      throw new Response("Kies met welke eHerkenning u inlogt bij RVO.", { status: 400 })
    }

    const rvoClient = createConfiguredRvoClient(rvoCredentials)

    const { state, cookieHeader } = await createRvoState(b_id_farm, url.toString(), rvoMode.data)

    const authUrl = generateAuthUrl(rvoClient, state)

    // Set state in cookie and redirect
    return redirect(authUrl, {
      headers: {
        "Set-Cookie": cookieHeader,
      },
    })
  }

  if (intent === "apply_changes") {
    const rvoImportReviewDataJson = formData.get("rvoImportReviewDataJson")
    const userChoicesJson = formData.get("userChoices")

    let rvoImportReviewData: ReviewItem[] = []
    let userChoices: UserChoiceMap = {}

    if (typeof rvoImportReviewDataJson !== "string" || typeof userChoicesJson !== "string") {
      return {
        success: false,
        message: "Geen data gevonden om te verwerken. Start 'percelen ophalen bij RVO' opnieuw.",
      }
    }

    try {
      rvoImportReviewData = JSON.parse(rvoImportReviewDataJson)
      userChoices = JSON.parse(userChoicesJson)

      // Basic validation: ensure we have an array of items
      if (!Array.isArray(rvoImportReviewData)) {
        throw new Error("Invalid review data format")
      }

      const addedFields: { b_id: string; geometry: FieldGeometry }[] = []
      const onFieldAdded = async (_: FdmType, b_id: string, geometry: FieldGeometry) => {
        addedFields.push({ b_id, geometry })
      }

      await processRvoImport(
        fdm,
        session.principal_id,
        b_id_farm,
        rvoImportReviewData,
        userChoices,
        year,
        onFieldAdded,
      )

      const nmiApiKey = getNmiApiKey()
      if (nmiApiKey) {
        const chunkSize = 10
        const chunkedFeatures: { b_id: string; geometry: FieldGeometry }[][] = []
        for (let i = 0; i < addedFields.length; i += chunkSize) {
          chunkedFeatures.push(addedFields.slice(i, i + chunkSize))
        }
        for (const chunk of chunkedFeatures) {
          await Promise.all(
            chunk.map(async ({ b_id, geometry }) => {
              try {
                const soilEstimates = await getSoilParameterEstimatesForGeometry(
                  fdm,
                  geometry,
                  nmiApiKey,
                )
                await addSoilAnalysis(
                  fdm,
                  session.principal_id,
                  undefined,
                  "nl-other-nmi",
                  b_id,
                  soilEstimates.a_depth_lower ?? 30,
                  undefined,
                  soilEstimates,
                  soilEstimates.a_depth_upper,
                )
              } catch (e) {
                console.warn(`Failed to fetch soil estimates for field ${b_id}:`, e)
              }
            }),
          )
        }
      }

      captureEvent(session.principal_id, "fields_imported_rvo", {
        b_id_farm,
        field_count: addedFields.length,
        calendar: yearString,
      })

      return redirect(`/farm/${b_id_farm}`)
    } catch (e: any) {
      console.error("Error with processing RVO import: ", e)
      return {
        success: false,
        message: `Error with processing RVO import: ${await extractErrorMessage(e)}`,
      }
    }
  }

  return {}
}
