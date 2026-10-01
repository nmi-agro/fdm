import {
  addSoilAnalysis,
  addSoilImage,
  addSoilImageAnnotation,
  checkPermission,
  getCurrentSoilData,
  getField,
  getSoilAnalysis,
  getSoilParametersDescription,
  removeSoilAnalysis,
  removeSoilImage,
} from "@nmi-agro/fdm-core"
import { type ActionFunctionArgs, data, type LoaderFunctionArgs, useLoaderData } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { BcsWizard } from "~/components/blocks/soil-visual/bcs-wizard"
import { deleteObject } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { BCS_VISUAL_KEYS, type BcsSavePayload } from "~/lib/bcs"
import { deriveBcsScores } from "~/lib/bcs-derived.server"
import {
  BCS_IMAGE_OBJECT_KEY_PREFIX,
  BcsSavePayloadSchema,
  ensureValidDate,
  getBcsPath,
  getBcsRouteParams,
  sanitizeScores,
} from "~/lib/bcs-route.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

function getRouteParams(params: ActionFunctionArgs["params"]) {
  const { b_id, b_id_farm, calendar } = getBcsRouteParams(params)
  return { b_id, b_id_farm, calendar }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { b_id } = getRouteParams(params)
    const session = await getSession(request)
    const field = await getField(fdm, session.principal_id, b_id)
    if (!field) {
      throw data("Field is not found", {
        status: 404,
        statusText: "Field is not found",
      })
    }

    await checkPermission(
      fdm,
      "field",
      "write",
      b_id,
      session.principal_id,
      new URL(request.url).pathname,
    )

    const { labContext: _labContext, labAnalysisDate } = await deriveBcsScores(
      fdm,
      session.principal_id,
      b_id,
      new Date(),
    )

    const currentSoilData = await getCurrentSoilData(fdm, session.principal_id, b_id)
    const soilDataArray = Array.isArray(currentSoilData) ? currentSoilData : []
    const somItem = soilDataArray.find((item) => item.parameter === "a_som_loi")
    const phItem = soilDataArray.find((item) => item.parameter === "a_ph_cc")

    const rawSource = somItem?.a_source ?? phItem?.a_source ?? null
    const soilParameterDescription = getSoilParametersDescription()
    const sourceParam = soilParameterDescription.find(
      (x: { parameter: string }) => x.parameter === "a_source",
    )
    const sourceOption = sourceParam?.options?.find((x: { value: string }) => x.value === rawSource)
    const soilSource = sourceOption?.label ?? rawSource

    return {
      b_id,
      b_id_farm: params.b_id_farm,
      fieldName: field.b_name,
      labAnalysisDate,
      somLoi: typeof somItem?.value === "number" ? somItem.value : null,
      phCc: typeof phItem?.value === "number" ? phItem.value : null,
      soilSource,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FieldBcsNewRoute() {
  const loaderData = useLoaderData<typeof loader>()

  return <BcsWizard {...loaderData} />
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { b_id } = getRouteParams(params)

  if (request.method !== "POST") {
    throw data("Method not allowed", {
      status: 405,
      statusText: "Method not allowed",
    })
  }

  const rawPayload = await request.json()
  const parseResult = BcsSavePayloadSchema.safeParse(rawPayload)
  if (!parseResult.success) {
    throw data("Invalid payload format", {
      status: 400,
      statusText: "Invalid payload format",
    })
  }
  const payload = parseResult.data as BcsSavePayload
  const scores = sanitizeScores(payload.scores)
  if (!BCS_VISUAL_KEYS.some((key) => scores[key] != null)) {
    throw data("Geef minimaal één indicator voor BodemConditieScore op", {
      status: 400,
      statusText: "Geef minimaal één indicator voor BodemConditieScore op",
    })
  }

  const a_date = ensureValidDate(payload.a_date, "Beoordelingsdatum")
  const b_sampling_date = ensureValidDate(payload.b_sampling_date, "Bemonsteringsdatum")

  const objectKeyPrefix = BCS_IMAGE_OBJECT_KEY_PREFIX
  if (payload.images.some((image) => !image.objectKey?.startsWith(objectKeyPrefix))) {
    throw data("Ongeldige afbeeldingreferentie", {
      status: 400,
      statusText: "Ongeldige afbeeldingreferentie",
    })
  }

  let createdAnalysisId: string | null = null
  const createdImageIds: string[] = []

  try {
    const session = await getSession(request)
    createdAnalysisId = await addSoilAnalysis(
      fdm,
      session.principal_id,
      a_date,
      "other",
      b_id,
      Number(payload.a_depth_lower ?? 25),
      b_sampling_date,
      scores,
    )

    const analysis = await getSoilAnalysis(fdm, session.principal_id, createdAnalysisId)

    const tempImageIdToStoredId = new Map<string, string>()
    for (const [index, image] of payload.images.entries()) {
      const a_id_image = await addSoilImage(fdm, session.principal_id, analysis.b_id_sampling, {
        a_image_path: image.objectKey,
        a_image_type: undefined,
        a_image_order: index,
        a_image_caption: image.caption,
      })
      createdImageIds.push(a_id_image)
      tempImageIdToStoredId.set(image.tempId, a_id_image)
    }

    for (const [index, annotation] of payload.annotations.entries()) {
      const a_id_image = tempImageIdToStoredId.get(annotation.tempImageId)
      if (!a_id_image) {
        throw new Error(`Unknown tempImageId: ${annotation.tempImageId}`)
      }

      await addSoilImageAnnotation(fdm, session.principal_id, a_id_image, {
        a_image_annotation_type: annotation.type,
        a_image_annotation_coordinates: annotation.coordinates,
        a_image_annotation: annotation.text,
        a_image_annotation_bcs: annotation.bcsIndicator,
        a_image_annotation_order: index,
      })
    }

    return redirectWithSuccess(getBcsPath(params), {
      message: "BCS opgeslagen! 🎉",
    })
  } catch (error) {
    const session = await getSession(request)

    await Promise.allSettled(
      createdImageIds.map((a_id_image) =>
        removeSoilImage(fdm, session.principal_id, a_id_image, deleteObject),
      ),
    )

    if (createdAnalysisId) {
      await Promise.allSettled([removeSoilAnalysis(fdm, session.principal_id, createdAnalysisId)])
    }

    // Do NOT delete unregistered GCS objects using client-supplied objectKey values:
    // those keys are unverified and deleting them could allow an attacker to remove
    // arbitrary objects. Orphaned GCS uploads from failed saves are acceptable; a
    // separate cleanup job can remove them.

    return handleActionError(error)
  }
}
