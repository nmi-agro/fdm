import {
  addFertilizerPlan,
  FertilizerPlan,
  updateFertilizerPlanFilePath,
  getFertilizerPlans,
  getFertilizerPlan,
  removeFertilizerPlan,
  checkPermission,
  getFarm,
} from "@nmi-agro/fdm-core"
import { renderToStream } from "@react-pdf/renderer"
import { Outlet, useLoaderData } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import z from "zod"
import { columns } from "@/app/components/blocks/bemestingsplan/columns"
import { NewBemestingsplanForm } from "@/app/components/blocks/bemestingsplan/new-form"
import { DataTable } from "@/app/components/blocks/bemestingsplan/table"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { BemestingsplanPDF } from "~/components/blocks/pdf/bemestingsplan/BemestingsplanPDF"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "~/components/ui/empty"
import {
  collectBemestingsplanInputFromDatabase,
  computeBemestingsplanData,
  getBemestingsplanInputHash,
} from "~/integrations/bemestingsplan.server"
import { buildObjectKey, deleteObject, uploadObject } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { Route } from "./+types/farm.$b_id_farm.bemestingsplan"

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const session = await getSession(request)

    const [farm, fertilizerPlans] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
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

    return {
      fertilizerPlans: fertilizerPlansExtended,
      farmWritePermission: farmWritePermission,
      b_name_farm: farm.b_name_farm,
      b_id_farm: farm.b_id_farm,
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
            handleActionError(deleteError)
          }
        }
        throw uploadObjectError
      }

      return redirectWithSuccess(
        `/farm/${b_id_farm}/bemestingsplan/${p_id_plan}`,
        `Bemestingsplan voor ${formValues.year} is succesvol opgericht.`,
      )
    }

    if (formValues.intent === "delete_plan") {
      const plan = await getFertilizerPlan(fdm, session.principal_id, formValues.p_id_plan)
      await removeFertilizerPlan(fdm, session.principal_id, formValues.p_id_plan)
      await deleteObject(plan.p_plan_file_path)

      return redirectWithSuccess(
        `/farm/${b_id_farm}/bemestingsplan`,
        `Bemestingsplan voor ${plan.p_plan_year} is succesvol verwijdert.`,
      )
    }
  } catch (err) {
    throw handleActionError(err)
  }
}

export default function FertilizerPlanTable() {
  const { fertilizerPlans, b_name_farm, b_id_farm, farmWritePermission } =
    useLoaderData<typeof loader>()

  if (fertilizerPlans.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Er zijn nog geen bemestingsplannen voor dit bedrijf opgesteld.</EmptyTitle>
          <EmptyContent>U kunt hieronder een nieuw bemestingsplan opstellen.</EmptyContent>
        </EmptyHeader>
        <EmptyContent>
          <NewBemestingsplanForm />
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <main>
      <FarmTitle
        title="Bemestingsplannen voor dit bedrijf"
        description="Hier kunt u de eerder ingestelde bemestingsplannen beheren."
      />
      <div className="p-6">
        <DataTable
          data={fertilizerPlans}
          columns={columns}
          b_name_farm={b_name_farm}
          b_id_farm={b_id_farm}
          canModify={farmWritePermission}
        />
      </div>
      {/* for the PDF viewer dialog */}
      <Outlet />
    </main>
  )
}
