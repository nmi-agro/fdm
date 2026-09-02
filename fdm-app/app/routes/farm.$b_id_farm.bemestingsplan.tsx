import {
  addFertilizerPlan,
  FertilizerPlan,
  updateFertilizerPlanFilePath,
  getFertilizerPlans,
  getFertilizerPlan,
  removeFertilizerPlan,
  checkPermission,
  getFarm,
  getFarms,
} from "@nmi-agro/fdm-core"
import { renderToStream } from "@react-pdf/renderer"
import { MetaFunction, Outlet, useLoaderData } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import z from "zod"
import { columns } from "@/app/components/blocks/bemestingsplan/columns"
import { NewBemestingsplanForm } from "@/app/components/blocks/bemestingsplan/new-form"
import { DataTable } from "@/app/components/blocks/bemestingsplan/table"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BemestingsplanPDF } from "~/components/blocks/pdf/bemestingsplan/BemestingsplanPDF"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "~/components/ui/empty"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { buildObjectKey, deleteObject, isGcsConfigured, uploadObject } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import {
  collectBemestingsplanInputFromDatabase,
  computeBemestingsplanData,
  getBemestingsplanInputHash,
} from "~/lib/bemestingsplan.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { Route } from "./+types/farm.$b_id_farm.bemestingsplan"
import { dataWithError } from "remix-toast"

export const meta: MetaFunction = () => {
  return [
    { title: `Bemestingsplan | ${clientConfig.name}` },
    {
      name: "description",
      content: "PDFs met gebruiksruimte en bemestingsadvies op bedrijfs- en perceelsniveau.",
    },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const session = await getSession(request)

    const [farm, farms, fertilizerPlans] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      getFertilizerPlans(fdm, session.principal_id, b_id_farm),
    ])

    const statusYears = new Set(fertilizerPlans.map((plan) => plan.p_plan_year))
    const statusHashes = new Map<number, Promise<string>>()

    let lastHashPromise = Promise.resolve("")
    for (const year of statusYears) {
      const hashPromise = lastHashPromise.then(async () => {
        const inputData = await collectBemestingsplanInputFromDatabase(
          fdm,
          session.principal_id,
          b_id_farm,
          year,
        )
        return getBemestingsplanInputHash(inputData)
      })
      statusHashes.set(year, hashPromise)
      lastHashPromise = hashPromise
    }

    async function checkPlanStatus(plan: FertilizerPlan) {
      const hashPromise = statusHashes.get(plan.p_plan_year)

      if (!hashPromise) {
        return "unknown"
      }

      return (await hashPromise) === plan.p_plan_hash ? "fresh" : "expired"
    }

    const fertilizerPlansExtended = fertilizerPlans.map((plan) => ({
      ...plan,
      status: checkPlanStatus(plan),
    }))

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      "routes/farm.$b_id_farm.bemestingsplan",
      false,
    )

    const farmOptions = farms.map((farm) => {
      return {
        b_id_farm: farm.b_id_farm,
        b_name_farm: farm.b_name_farm,
      }
    })

    return {
      fertilizerPlans: fertilizerPlansExtended,
      farmWritePermission: farmWritePermission,
      b_name_farm: farm.b_name_farm,
      b_id_farm: farm.b_id_farm,
      farmOptions: farmOptions,
      isGcsConfigured: isGcsConfigured(),
    }
  } catch (err) {
    throw handleLoaderError(err)
  }
}

const ActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("establish_plan"),
    year: z
      .string()
      .min(1)
      .transform((x) => Number.parseInt(x, 10))
      .pipe(z.int()),
  }),
  z.object({ intent: z.literal("delete_plan"), p_id_plan: z.string().min(1) }),
])

export async function action({ params, request }: Route.ActionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const session = await getSession(request)
    const formValues = await extractFormValuesFromRequest(request, ActionSchema)

    if (formValues.intent === "establish_plan") {
      if (!isGcsConfigured()) {
        return dataWithError(
          null,
          "Het opslaan van een bemestingsplan is niet beschikbaar omdat Google Cloud Storage niet is geconfigureerd (GCS_BUCKET_NAME ontbreekt).",
        )
      }

      const dataCollectionDate = new Date()
      const collectedData = await collectBemestingsplanInputFromDatabase(
        fdm,
        session.principal_id,
        b_id_farm,
        formValues.year,
      )
      const inputHash = getBemestingsplanInputHash(collectedData)
      const computedData = await computeBemestingsplanData(collectedData)
      const p_id_plan = await addFertilizerPlan(
        fdm,
        session.principal_id,
        b_id_farm,
        formValues.year,
        `inputHash.pdf`,
        inputHash,
        dataCollectionDate,
      )
      const objectKey = buildObjectKey("bemestingsplan", p_id_plan, "pdf")
      const pdfStream = await renderToStream(<BemestingsplanPDF data={computedData} />)
      let uploaded = false
      try {
        await uploadObject(objectKey, pdfStream, "application/pdf")
        uploaded = true
        await updateFertilizerPlanFilePath(fdm, session.principal_id, p_id_plan, objectKey)
      } catch (uploadObjectError) {
        if (uploaded) {
          try {
            await deleteObject(objectKey)
          } catch (deleteError) {
            void handleActionError(deleteError)
          }
          try {
            await removeFertilizerPlan(fdm, session.principal_id, p_id_plan)
          } catch (removeError) {
            void handleActionError(removeError)
          }
        }
        throw uploadObjectError
      }

      return redirectWithSuccess(
        `/farm/${b_id_farm}/bemestingsplan/${p_id_plan}`,
        `Bemestingsplan voor teeltjaar ${formValues.year} is succesvol gegenereerd.`,
      )
    }

    if (formValues.intent === "delete_plan") {
      const plan = await getFertilizerPlan(fdm, session.principal_id, formValues.p_id_plan)
      await removeFertilizerPlan(fdm, session.principal_id, formValues.p_id_plan)
      await deleteObject(plan.p_plan_file_path)

      return redirectWithSuccess(
        `/farm/${b_id_farm}/bemestingsplan`,
        `Bemestingsplan voor teeltjaar ${plan.p_plan_year} is succesvol verwijderd.`,
      )
    }
  } catch (err) {
    throw handleActionError(err)
  }
}

export default function FertilizerPlanTable() {
  const { fertilizerPlans, b_name_farm, b_id_farm, farmWritePermission, farmOptions, isGcsConfigured } =
    useLoaderData<typeof loader>()

  return (
    <>
      <Header
        action={{
          to: `/farm/${b_id_farm}`,
          label: "Terug",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem>Bemestingsplannen</BreadcrumbItem>
      </Header>
      <main>
        <FarmTitle
          title="Bemestingsplan"
          description="Overzicht van de gegenereerde bemestingsplannen voor dit bedrijf."
        />
        <div className="p-6 space-y-6">
          {!isGcsConfigured && (
            <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-800!" />
              <AlertTitle>Opslag van bemestingsplannen niet beschikbaar</AlertTitle>
              <AlertDescription>
                Het genereren en opslaan van PDF-bemestingsplannen vereist Google Cloud Storage (GCS_BUCKET_NAME ontbreekt).
              </AlertDescription>
            </Alert>
          )}
          {fertilizerPlans.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  Er zijn nog geen bemestingsplannen gegenereerd voor dit bedrijf.
                </EmptyTitle>
                <EmptyContent>
                  Hieronder kunt u een nieuw bemestingsplan genereren per teeltjaar.
                </EmptyContent>
              </EmptyHeader>
              {farmWritePermission && isGcsConfigured && (
                <EmptyContent className="mt-2 flex justify-center">
                  <NewBemestingsplanForm />
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <DataTable
              data={fertilizerPlans}
              columns={columns}
              b_name_farm={b_name_farm}
              b_id_farm={b_id_farm}
              canModify={farmWritePermission && isGcsConfigured}
            />
          )}
        </div>
        {/* for the PDF viewer dialog */}
        <Outlet />
      </main>
    </>
  )
}
