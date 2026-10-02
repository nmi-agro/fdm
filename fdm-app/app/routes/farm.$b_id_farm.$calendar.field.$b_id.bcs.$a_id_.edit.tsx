import {
  addSoilImage,
  addSoilImageAnnotation,
  checkPermission,
  getField,
  getSoilAnalysis,
  getSoilImages,
  removeSoilImage,
  removeSoilImageAnnotation,
  updateSoilAnalysis,
} from "@nmi-agro/fdm-core"
import { type ActionFunctionArgs, data, type LoaderFunctionArgs, useLoaderData } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { BcsEditForm } from "~/components/blocks/soil-visual/bcs-edit-form"
import { deleteObject, generateSignedReadUrl } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { BCS_VISUAL_KEYS, type BcsVisualKey, isBcsAnalysis } from "~/lib/bcs"
import { deriveBcsScores } from "~/lib/bcs-derived.server"
import {
  BCS_IMAGE_OBJECT_KEY_PREFIX,
  BcsEditPayloadSchema,
  ensureValidDate,
  getBcsPath,
  getBcsRouteParams,
  parseAnnotationCoordinates,
  sanitizeScores,
} from "~/lib/bcs-route.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

function getRouteParams(params: ActionFunctionArgs["params"]) {
  const { a_id, b_id, b_id_farm, calendar } = getBcsRouteParams(params)
  if (!a_id) {
    throw data("Analysis ID is required", {
      status: 400,
      statusText: "Analysis ID is required",
    })
  }
  return { a_id, b_id, b_id_farm, calendar }
}

function getDetailPath(params: ActionFunctionArgs["params"]) {
  const { a_id } = getRouteParams(params)
  return `${getBcsPath(params)}/${a_id}`
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { a_id, b_id, b_id_farm } = getRouteParams(params)
    const session = await getSession(request)

    const field = await getField(fdm, session.principal_id, b_id)
    if (!field) {
      throw data("Field is not found", { status: 404, statusText: "Field is not found" })
    }

    await checkPermission(
      fdm,
      "field",
      "write",
      b_id,
      session.principal_id,
      new URL(request.url).pathname,
    )

    const analysis = await getSoilAnalysis(fdm, session.principal_id, a_id)
    if (analysis.b_id !== b_id || !isBcsAnalysis(analysis)) {
      throw data("BodemConditieScore is niet gevonden", {
        status: 404,
        statusText: "BodemConditieScore is niet gevonden",
      })
    }

    const images = await getSoilImages(fdm, session.principal_id, analysis.b_id_sampling)
    const samplingDate = analysis.b_sampling_date ?? analysis.a_date ?? new Date()
    const { labAnalysisDate } = await deriveBcsScores(
      fdm,
      session.principal_id,
      b_id,
      new Date(samplingDate),
    )

    const scores = Object.fromEntries(
      BCS_VISUAL_KEYS.flatMap((key) => {
        const value = analysis[key]
        return value === 0 || value === 1 || value === 2 ? [[key, value]] : []
      }),
    ) as Partial<Record<BcsVisualKey, 0 | 1 | 2>>

    return {
      a_id,
      b_id,
      b_id_farm,
      fieldName: field.b_name,
      labAnalysisDate,
      samplingDate: new Date(samplingDate).toISOString(),
      scores,
      images: await Promise.all(
        images.map(async (image) => ({
          id: image.a_id_image,
          url: await generateSignedReadUrl(image.a_image_path),
          caption: image.a_image_caption ?? undefined,
          annotations: image.annotations.map((annotation) => ({
            id: annotation.a_id_annotation,
            type: (annotation.a_image_annotation_type ?? "pin") as
              | "pin"
              | "circle"
              | "arrow"
              | "freehand",
            coordinates: parseAnnotationCoordinates(annotation.a_image_annotation_coordinates),
            text: annotation.a_image_annotation ?? undefined,
            bcsIndicator: (annotation.a_image_annotation_bcs ?? undefined) as
              | BcsVisualKey
              | undefined,
          })),
        })),
      ),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FieldBcsEditRoute() {
  const loaderData = useLoaderData<typeof loader>()

  return <BcsEditForm {...loaderData} />
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { a_id, b_id } = getRouteParams(params)

  if (request.method !== "POST") {
    throw data("Method not allowed", { status: 405, statusText: "Method not allowed" })
  }

  const parseResult = BcsEditPayloadSchema.safeParse(await request.json())
  if (!parseResult.success) {
    throw data("Invalid payload format", { status: 400, statusText: "Invalid payload format" })
  }
  const payload = parseResult.data

  const scores = sanitizeScores(payload.scores)
  if (!BCS_VISUAL_KEYS.some((key) => scores[key] != null)) {
    throw data("Geef minimaal één indicator voor BodemConditieScore op", {
      status: 400,
      statusText: "Geef minimaal één indicator voor BodemConditieScore op",
    })
  }

  const a_date = ensureValidDate(payload.a_date, "Beoordelingsdatum")
  const b_sampling_date = ensureValidDate(payload.b_sampling_date, "Bemonsteringsdatum")

  const newImages = payload.images.filter((image) => !image.existingId)
  if (newImages.some((image) => !image.objectKey?.startsWith(BCS_IMAGE_OBJECT_KEY_PREFIX))) {
    throw data("Ongeldige afbeeldingreferentie", {
      status: 400,
      statusText: "Ongeldige afbeeldingreferentie",
    })
  }

  const createdImageIds: string[] = []

  try {
    const session = await getSession(request)

    await checkPermission(fdm, "field", "write", b_id, session.principal_id, "bcs-edit")

    const analysis = await getSoilAnalysis(fdm, session.principal_id, a_id)
    if (analysis.b_id !== b_id || !isBcsAnalysis(analysis)) {
      throw data("Geen BodemConditieScore analyse", {
        status: 403,
        statusText: "Geen BodemConditieScore analyse",
      })
    }

    // Existing ids sent by the client must belong to this analysis.
    const storedImages = await getSoilImages(fdm, session.principal_id, analysis.b_id_sampling)
    const storedImageIds = new Set(storedImages.map((image) => image.a_id_image))
    const storedAnnotationIds = new Set(
      storedImages.flatMap((image) => image.annotations.map((a) => a.a_id_annotation)),
    )

    const keptImageIds = new Set(
      payload.images.flatMap((image) => (image.existingId ? [image.existingId] : [])),
    )
    if ([...keptImageIds].some((id) => !storedImageIds.has(id))) {
      throw data("Ongeldige afbeeldingreferentie", {
        status: 400,
        statusText: "Ongeldige afbeeldingreferentie",
      })
    }

    const tempIdToStoredId = new Map<string, string>()
    for (const image of payload.images) {
      if (image.existingId) tempIdToStoredId.set(image.tempId, image.existingId)
    }

    const keptAnnotationIds = new Set(
      payload.annotations.flatMap((annotation) =>
        annotation.existingId ? [annotation.existingId] : [],
      ),
    )
    if ([...keptAnnotationIds].some((id) => !storedAnnotationIds.has(id))) {
      throw data("Ongeldige notitiereferentie", {
        status: 400,
        statusText: "Ongeldige notitiereferentie",
      })
    }

    const clearedScores = Object.fromEntries(
      BCS_VISUAL_KEYS.filter((key) => scores[key] == null).map((key) => [key, null]),
    ) as Partial<Record<BcsVisualKey, null>>

    await updateSoilAnalysis(fdm, session.principal_id, a_id, {
      a_date,
      b_sampling_date,
      ...clearedScores,
      ...scores,
    })

    for (const [index, image] of newImages.entries()) {
      const a_id_image = await addSoilImage(fdm, session.principal_id, analysis.b_id_sampling, {
        a_image_path: image.objectKey as string,
        a_image_type: undefined,
        a_image_order: keptImageIds.size + index,
        a_image_caption: image.caption,
      })
      createdImageIds.push(a_id_image)
      tempIdToStoredId.set(image.tempId, a_id_image)
    }

    for (const [index, annotation] of payload.annotations.entries()) {
      if (annotation.existingId) continue
      const a_id_image = tempIdToStoredId.get(annotation.tempImageId)
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

    // Removals run last so a failure above leaves the stored data intact.
    for (const image of storedImages) {
      if (!keptImageIds.has(image.a_id_image)) {
        await removeSoilImage(fdm, session.principal_id, image.a_id_image, deleteObject)
        continue
      }
      for (const annotation of image.annotations) {
        if (!keptAnnotationIds.has(annotation.a_id_annotation)) {
          await removeSoilImageAnnotation(fdm, session.principal_id, annotation.a_id_annotation)
        }
      }
    }

    return redirectWithSuccess(getDetailPath(params), {
      message: "BodemConditieScore is bijgewerkt!",
    })
  } catch (error) {
    const session = await getSession(request)

    await Promise.allSettled(
      createdImageIds.map((a_id_image) =>
        removeSoilImage(fdm, session.principal_id, a_id_image, deleteObject),
      ),
    )

    // Client-supplied object keys are never deleted here: they are unverified.
    return handleActionError(error)
  }
}
