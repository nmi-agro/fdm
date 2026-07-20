import type { Resolver } from "react-hook-form"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { updateUserProfile } from "@nmi-agro/fdm-core"
import { FileUpload, parseFormData } from "@remix-run/form-data-parser"
import imageSize from "image-size"
import { User } from "lucide-react"
import crypto from "node:crypto"
import { useRef, useState, useTransition } from "react"
import { Controller } from "react-hook-form"
import { Form, redirect, useLoaderData, useNavigation, useSubmit } from "react-router"
import { useRemixForm } from "remix-hook-form"
import { redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { AuthCard } from "~/components/blocks/auth/auth-card"
import { AuthLayout } from "~/components/blocks/auth/auth-layout"
import { ProfileInfoSchema } from "~/components/blocks/profile/profile-info-schema"
import {
  ALLOWED_MIME_TYPES,
  cropProfilePicture,
  MAX_DIMENSIONS,
  MAX_SIZE_BYTES,
  MIME_TO_EXT,
  ProfilePictureInput,
} from "~/components/blocks/profile/profile-picture-manager"
import { Button } from "~/components/ui/button"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { buildObjectKey, deleteObject, uploadObject } from "~/integrations/gcs.server"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { readAndValidateFileUpload } from "~/lib/upload-utils.server"
import { cn } from "~/lib/utils"
import { detectExistingProfilePictureObjectKey } from "../components/blocks/profile/detect-existing.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Welkom | ${clientConfig.name}` },
    {
      name: "description",
      content: `Welkom bij ${clientConfig.name}. Maak je profiel compleet om door te gaan.`,
    },
  ]
}

/**
 * Checks for an existing user session and redirects authenticated users.
 *
 * This asynchronous loader function retrieves the user session from the request headers
 * via the authentication API. If a valid session exists, the function redirects the user
 * to the "/farm" route; otherwise, it returns an empty object. Any errors during session
 * retrieval are processed by {@link handleLoaderError} and thrown.
 *
 * @param request - The HTTP request object whose headers are used to retrieve the session.
 *
 * @returns A redirect response to "/farm" if a session exists, or an empty object otherwise.
 *
 * @throws {Error} If session retrieval fails, the error processed by {@link handleLoaderError} is thrown.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get the session
    const session = await getSession(request)

    // Return user information from loader
    return {
      firstname: session.user.firstname,
      surname: session.user.surname,
      image: session.user.image,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

const WelcomeSchema = ProfileInfoSchema.extend({
  doNotUseSocialImage: z.coerce
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
})
/**
 * Renders the welcome page for profile completion.
 *
 * This component displays a form for users to complete their profile by entering their firstname and surname.
 * It shows the user's avatar if available and handles form submission with validation.
 *
 * @returns A React element representing the profile completion page.
 */
export default function Welcome() {
  const loaderData = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const submit = useSubmit()

  const [isProcessingForm, processForm] = useTransition()

  const formRef = useRef<HTMLFormElement>(null)
  const form = useRemixForm<z.infer<typeof WelcomeSchema>>({
    mode: "onTouched",
    resolver: zodResolver(WelcomeSchema) as Resolver<z.infer<typeof WelcomeSchema>>,
    stringifyAllValues: false,
    defaultValues: {
      doNotUseSocialImage: false,
      firstname: loaderData.firstname || "",
      surname: loaderData.surname || "",
    },
    submitHandlers: {
      async onValid() {
        if (!formRef.current) return
        const formData = new FormData(formRef.current)
        processForm(async () => {
          const formDataWithCroppedPic = await cropProfilePicture(formData)
          submit(formDataWithCroppedPic, {
            action: "/welcome",
            method: "post",
            encType: "multipart/form-data",
          })
        })
      },
    },
  })

  const doNotUseSocialImage = form.watch("doNotUseSocialImage")

  const profilePictureInputRef = useRef<HTMLInputElement>(null)
  const [profilePictureFiles, setProfilePictureFiles] = useState<File[]>([])

  const profilePictureMode = profilePictureFiles.length
    ? "toBeUploaded"
    : doNotUseSocialImage
      ? "toBeRemoved"
      : "noOperation"

  const isSubmitting =
    (navigation.state !== "idle" && navigation.formMethod === "POST") || isProcessingForm

  return (
    <AuthLayout showCookieSettings={true}>
      <AuthCard
        title="Profiel voltooien"
        description={`Welkom bij ${clientConfig.name}. Vul je naam aan om direct te starten met je percelen, bemesting en bodemdata.`}
        footer={
          <p className="text-muted-foreground text-center text-xs">
            Je kunt dit later altijd aanpassen via je profielinstellingen.
          </p>
        }
      >
        <Form ref={formRef} id="formWelcome" onSubmit={form.handleSubmit} method="post">
          <fieldset disabled={isSubmitting}>
            <div className="grid w-full items-center gap-4">
              <input type="hidden" name="doNotUseSocialImage" value={String(doNotUseSocialImage)} />
              <Controller
                control={form.control}
                name="firstname"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Voornaam</FieldLabel>
                    <Input placeholder="bv. Jan" aria-required="true" required {...field} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="surname"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Achternaam</FieldLabel>
                    <Input placeholder="bv. de Vries" aria-required="true" required {...field} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Field className="mx-auto max-w-75">
                <FieldLabel>
                  {profilePictureMode === "toBeRemoved"
                    ? "Foto niet te gebruiken"
                    : loaderData.image
                      ? "Foto"
                      : "Foto (optioneel)"}
                </FieldLabel>
                <div
                  className={cn("space-y-2", profilePictureMode === "toBeRemoved" && "opacity-50")}
                >
                  <ProfilePictureInput
                    ref={profilePictureInputRef}
                    appAspectRatio={3 / 2}
                    files={profilePictureFiles}
                    onFilesChange={setProfilePictureFiles}
                    maxFileSize={MAX_SIZE_BYTES}
                    currentPicture={loaderData.image}
                    currentAlt="Huidige profielfoto"
                    avatarFallback={<User />}
                  />
                </div>
                <div className="flex justify-center gap-2 overflow-visible">
                  {profilePictureMode === "toBeRemoved" ? (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => form.setValue("doNotUseSocialImage", false)}
                    >
                      Gebruiken
                    </Button>
                  ) : profilePictureMode === "toBeUploaded" ? (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setProfilePictureFiles([])}
                    >
                      {loaderData.image ? "Gebruik geïmporteerd" : "Verwijderen"}
                    </Button>
                  ) : (
                    <>
                      {loaderData.image && (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => form.setValue("doNotUseSocialImage", true)}
                        >
                          Niet gebruiken
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          profilePictureInputRef.current?.click()
                        }}
                      >
                        {loaderData.image ? "Kies andere afbeelding" : "Kies een afbeelding"}
                      </Button>
                    </>
                  )}
                </div>
              </Field>
              <Button type="submit" className="w-full">
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <Spinner />
                    <span>Opslaan...</span>
                  </div>
                ) : (
                  "Doorgaan"
                )}
              </Button>
            </div>
          </fieldset>
        </Form>
      </AuthCard>
    </AuthLayout>
  )
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get the URL object to extract search params
    const url = new URL(request.url)
    const redirectTo = url.searchParams.get("redirectTo") || "/farm"
    // Validate redirectTo to prevent open redirect
    const isValidRedirect = redirectTo.startsWith("/") && !redirectTo.startsWith("//")
    const safeRedirectTo = isValidRedirect ? redirectTo : "/farm"

    let fileBuffer: Buffer | null = null
    let detectedMime: string | null = null

    const uploadHandler = async (fileUpload: FileUpload) => {
      if (fileUpload.fieldName !== "file") return undefined

      // The file submission will be empty if the user hasn't added a profile picture
      if (fileUpload.name === "" && fileUpload.size === 0) return

      const result = await readAndValidateFileUpload(fileUpload, ALLOWED_MIME_TYPES)
      fileBuffer = result.buffer
      detectedMime = result.mime

      const imagePixelSize = imageSize(fileBuffer)
      if (imagePixelSize.width > MAX_DIMENSIONS || imagePixelSize.height > MAX_DIMENSIONS) {
        throw new Error("De foto is te groot of te breed.")
      }

      return new File([new Uint8Array(fileBuffer)], fileUpload.name, {
        type: detectedMime,
      })
    }

    let formData: FormData
    try {
      formData = await parseFormData(request, { maxFileSize: MAX_SIZE_BYTES }, uploadHandler)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid upload"
      return Response.json({ error: message }, { status: 400 })
    }

    const actionSchemaResult = WelcomeSchema.safeParse(Object.fromEntries(formData.entries()))

    if (actionSchemaResult.error) {
      return Response.json({ errors: actionSchemaResult.error }, { status: 400 })
    }
    const formValues = actionSchemaResult.data

    let profilePicture: { buffer: Uint8Array; hash: string; detectedMime: string } | null = null

    if (fileBuffer && detectedMime) {
      const hash = crypto.createHash("md5", { outputLength: 16 }).update(fileBuffer).digest("hex")

      profilePicture = { buffer: fileBuffer, hash: hash, detectedMime: detectedMime }
    }

    const { firstname, surname, doNotUseSocialImage } = formValues

    // Get the current user profile
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      return redirect("/signin")
    }

    // Update the user profile
    await updateUserProfile(fdm, session.user.id, firstname, surname)

    if (profilePicture) {
      const detectedExt = MIME_TO_EXT[profilePicture.detectedMime]

      const objectKey = buildObjectKey("profile_picture_user", session.user.id, detectedExt)

      try {
        await uploadObject(objectKey, profilePicture.hash, profilePicture.detectedMime)

        await auth.api.updateUser({
          headers: request.headers,
          body: {
            image: `/api/profile-picture/user/${session.user.id}.${detectedExt}?hash=${profilePicture.hash}`,
          },
        })
      } catch (err) {
        try {
          await deleteObject(objectKey)
        } catch (revertError) {
          handleActionError(revertError)
        }
        throw err
      }
    } else if (doNotUseSocialImage) {
      const oldProfilePictureKey = detectExistingProfilePictureObjectKey(session.user.image)

      await auth.api.updateUser({ headers: request.headers, body: { image: null } })

      if (oldProfilePictureKey) {
        try {
          await deleteObject(oldProfilePictureKey)
        } catch (err) {
          try {
            await auth.api.updateUser({
              headers: request.headers,
              body: { image: session.user.image },
            })
          } catch (revertErr) {
            handleActionError(revertErr)
          }
          throw err
        }
      }
    }

    return redirectWithSuccess(safeRedirectTo, "Je profiel is voltooid!")
  } catch (error) {
    console.error("Error updating user profile")
    return handleActionError(error)
  }
}
