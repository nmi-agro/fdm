import type {
  ImportReviewAction,
  RvoImportReviewItem,
  UserChoiceMap,
} from "@nmi-agro/fdm-rvo/types"
import type { ZodError } from "zod"
import {
  addFarmVerification,
  addSoilAnalysis,
  type Cultivation,
  type FdmType,
  type Field,
  type FieldGeometry,
  getCultivationsFromCatalogue,
  getFarm,
} from "@nmi-agro/fdm-core"
import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  Form,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { RvoConnectCard } from "~/components/blocks/rvo/connect-card"
import { RvoErrorAlert } from "~/components/blocks/rvo/error-alert"
import { RvoImportReviewTable } from "~/components/blocks/rvo/import-review-table"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import { SidebarInset } from "~/components/ui/sidebar"
import { getNmiApiKey, getSoilParameterEstimatesForGeometry } from "~/integrations/nmi.server"
import {
  createConfiguredRvoClient,
  createRvoState,
  getRvoCredentials,
  getRvoPermissionDeniedMessage,
  parseRvoToken,
  RvoRequestModeSchema,
  rvoTokenCookie,
} from "~/integrations/rvo.server"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
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

type ReviewItem = RvoImportReviewItem<Field>

export const meta: MetaFunction = ({ params }) => {
  const b_id_farm = params.b_id_farm
  return [{ title: `Percelen ophalen bij RVO - Nieuw Bedrijf ${b_id_farm}` }]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { b_id_farm, calendar: yearString } = params
  if (!b_id_farm || !yearString) {
    throw new Response("Farm ID en kalender zijn verplicht", {
      status: 400,
    })
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
  let b_businessid_farm: string | null = null
  let b_name_farm: string | null | undefined = null

  // Check if RVO is configured
  const rvoCredentials = getRvoCredentials()
  const isRvoConfigured = rvoCredentials !== undefined

  const farm = await getFarm(fdm, session.principal_id, b_id_farm)
  if (farm) {
    b_businessid_farm = farm.b_businessid_farm
    b_name_farm = farm.b_name_farm
  }

  // rvo_token cookie is set by /callback/rvo after a successful token exchange
  if (rvoToken) {
    const { accessToken: rvoAccessToken, mode: rvoMode } = rvoToken
    try {
      if (!isRvoConfigured) {
        throw new Response("RVO client is not configured.", {
          status: 500,
        })
      }

      if (!farm?.b_businessid_farm) {
        throw new Response("Geen KvK-nummer gevonden voor dit bedrijf.", { status: 400 })
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
        // Capture an event when there is an error with fetching.
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
          throw new Response(getRvoPermissionDeniedMessage(rvoMode), { status: 403 })
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

      const cultivationsCatalogue = await getCultivationsFromCatalogue(
        fdm,
        session.principal_id,
        b_id_farm,
      )

      const localFieldsExtended: (Field & {
        cultivations: Cultivation[]
      })[] = [] // No existing fields to compare against yet in create wizard, so localFields is empty
      rvoImportReviewData = compareFields(
        localFieldsExtended,
        rvoFields,
        year,
        cultivationsCatalogue,
      )
    } catch (e) {
      console.error("RVO Import Fout:", e)
      if (e instanceof Response && e.status === 403) {
        throw e
      }
      error = await extractErrorMessage(e)
    }
  } else if (!url.searchParams.has("start_import")) {
    const clearedTokenCookie = await rvoTokenCookie.serialize("", {
      maxAge: 0,
    })
    return data(
      {
        b_id_farm,
        b_businessid_farm,
        calendar: yearString,
        rvoImportReviewData: [],
        error: null,
        showImportButton: true,
        noRvoParcelsFound: false,
        isRvoConfigured,
        b_name_farm,
      },
      { headers: { "Set-Cookie": clearedTokenCookie } },
    )
  }

  const clearedTokenCookie = await rvoTokenCookie.serialize("", { maxAge: 0 })
  const noRvoParcelsFound = !error && rvoImportReviewData.length === 0
  return data(
    {
      b_id_farm,
      b_businessid_farm,
      calendar: yearString,
      rvoImportReviewData,
      error,
      showImportButton: noRvoParcelsFound,
      noRvoParcelsFound,
      isRvoConfigured,
      b_name_farm,
    },
    { headers: { "Set-Cookie": clearedTokenCookie } },
  )
}

export default function RvoImportCreatePage() {
  const {
    b_id_farm,
    b_businessid_farm,
    calendar,
    rvoImportReviewData,
    error,
    showImportButton,
    noRvoParcelsFound,
    isRvoConfigured,
    b_name_farm,
  } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const location = useLocation()

  const isImporting =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "start_import"
  const isSaving =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "save_fields"

  const [userChoices, setUserChoices] = useState<UserChoiceMap>({})

  useEffect(() => {
    // Initialize user choices with defaults
    const initialChoices: UserChoiceMap = {}
    rvoImportReviewData.forEach((item) => {
      const id = getItemId(item)
      let defaultAction: ImportReviewAction

      switch (item.status) {
        case "NEW_REMOTE":
          defaultAction = "ADD_REMOTE"
          break
        // In creation wizard, other statuses are unlikely but good to handle defaults
        default:
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

  if (error) {
    return (
      <SidebarInset>
        <Header action={undefined}>
          <HeaderFarmCreate b_name_farm={b_name_farm} />
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>Percelen ophalen bij RVO</BreadcrumbLink>
          </BreadcrumbItem>
        </Header>
        <main className="flex-1 overflow-auto">
          <div className="flex items-center justify-between">
            <FarmTitle
              title="Fout bij ophalen percelen bij RVO"
              description="Er is iets misgegaan bij het ophalen van de gegevens."
            />
          </div>
          <FarmContent>
            <div className="flex flex-col space-y-8 pb-10 lg:flex-row lg:space-y-0 lg:space-x-12">
              <div className="w-full">
                <RvoErrorAlert error={error} retryPath={location.pathname} />
              </div>
            </div>
          </FarmContent>
        </main>
      </SidebarInset>
    )
  }

  return (
    <SidebarInset>
      <Header action={undefined}>
        <HeaderFarmCreate b_name_farm={b_name_farm} />
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink>Percelen ophalen bij RVO</BreadcrumbLink>
        </BreadcrumbItem>
      </Header>
      <main className="flex-1 overflow-auto">
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
                beheerder om de RVO toegangsgegevens toe te voegen.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {rvoImportReviewData.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="w-full max-w-lg space-y-6">
              {noRvoParcelsFound && (
                <Alert>
                  <AlertTitle>Geen percelen gevonden</AlertTitle>
                  <AlertDescription>
                    Er zijn geen percelen gevonden voor dit bedrijf bij RVO. Controleer het
                    KvK-nummer en probeer opnieuw.
                  </AlertDescription>
                </Alert>
              )}
              {showImportButton && (
                <RvoConnectCard
                  b_businessid_farm={b_businessid_farm}
                  b_id_farm={b_id_farm}
                  isImporting={isImporting}
                  isRvoConfigured={isRvoConfigured}
                />
              )}
            </div>
          </div>
        ) : (
          <>
            <FarmTitle
              title="Verwerken van geïmporteerde percelen"
              description="Controleer de percelen opgehaald vanuit RVO. Deze worden toegevoegd aan uw nieuwe bedrijf."
            />

            <FarmContent>
              <div className="flex flex-col space-y-4 pb-10">
                <div className="flex justify-end">
                  <Form method="post" action={`/farm/create/${b_id_farm}/${calendar}/rvo`}>
                    <input type="hidden" name="intent" value="save_fields" />
                    <input type="hidden" name="userChoices" value={JSON.stringify(userChoices)} />
                    <input
                      type="hidden"
                      name="RvoImportReviewDataJson"
                      value={JSON.stringify(rvoImportReviewData)}
                    />
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opslaan...
                        </>
                      ) : (
                        "Opslaan en verder"
                      )}
                    </Button>
                  </Form>
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

export async function action({ request, params, url }: ActionFunctionArgs) {
  const { b_id_farm, calendar: yearString } = params
  if (!b_id_farm || !yearString) {
    throw new Response("b_id_farm and calendar are required", {
      status: 400,
    })
  }
  const year = Number(yearString)
  if (!Number.isInteger(year)) {
    throw new Response("Ongeldig kalenderjaar", { status: 400 })
  }

  const session = await getSession(request)
  const formData = await request.formData()
  const intent = formData.get("intent")

  if (intent === "start_import") {
    const rvoCredentials = getRvoCredentials()
    const isRvoConfigured = rvoCredentials !== undefined

    if (!isRvoConfigured) {
      throw new Response("RVO client is not available", { status: 500 })
    }

    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
    if (!farm?.b_businessid_farm) {
      throw new Response("Geen KvK-nummer gevonden voor dit bedrijf.", {
        status: 400,
      })
    }

    const rvoMode = RvoRequestModeSchema.safeParse(formData.get("rvo_mode"))
    if (!rvoMode.success) {
      throw new Response(
        "Kies of u gegevens ophaalt voor uw eigen bedrijf of namens een ander bedrijf.",
        { status: 400 },
      )
    }

    const rvoClient = createConfiguredRvoClient(rvoCredentials)

    const { state, cookieHeader } = await createRvoState(b_id_farm, url.toString(), rvoMode.data)

    const authUrl = generateAuthUrl(rvoClient, state)

    return redirect(authUrl, {
      headers: {
        "Set-Cookie": cookieHeader,
      },
    })
  }

  if (intent === "save_fields") {
    const RvoImportReviewDataJson = formData.get("RvoImportReviewDataJson")
    const userChoicesJson = formData.get("userChoices")

    let rvoImportReviewData: ReviewItem[] = []
    let userChoices: UserChoiceMap = {}

    if (typeof RvoImportReviewDataJson !== "string" || typeof userChoicesJson !== "string") {
      return {
        success: false,
        message: "Geen data gevonden om te verwerken. Start de RVO import opnieuw.",
      }
    }

    try {
      rvoImportReviewData = JSON.parse(RvoImportReviewDataJson)
      userChoices = JSON.parse(userChoicesJson)

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

      return redirect(`/farm/create/${b_id_farm}/${yearString}/fields`)
    } catch (e: any) {
      console.error("Error at saving RVO fields: ", e)
      return {
        success: false,
        message: `Error at saving RVO fields: ${await extractErrorMessage(e)}`,
      }
    }
  }
}
