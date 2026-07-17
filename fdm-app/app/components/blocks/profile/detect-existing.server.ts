/**
 * Detect if the user might have an existing profile picture in GCS based on the image URL.
 * If so, returns the object key for it.
 *
 * @param imageUrl URL to check
 * @returns the object key if the url matches the pattern for a profile picture that is stored in GCS, null otherwise.
 */
export function detectExistingProfilePictureObjectKey(imageUrl: string | null | undefined) {
  if (typeof imageUrl !== "string") {
    return null
  }

  const types = ["user", "organization"] as const

  for (const type of types) {
    const prefix = `/api/profile-picture/${type}/`
    if (imageUrl.startsWith(prefix)) {
      return `profile_picture_${type}/${imageUrl.substring(prefix.length)}`
    }
  }

  return null
}
