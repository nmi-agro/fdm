/**
 * Local URLs for files the user chose, so that a PDF can be shown in the browser without uploading
 * it. One URL is made per file and kept for as long as the page lives: revoking it in an effect
 * cleanup breaks the preview, because React may run that cleanup while the URL is still shown.
 * The file itself is in memory anyway while it is shown.
 */
const urls = new WeakMap<File, string>()

/**
 * Returns a local URL for a file, the same one every time for the same file.
 *
 * @param file - A file the user chose.
 * @returns A `blob:` URL that shows the file.
 */
export function getObjectUrl(file: File): string {
  let url = urls.get(file)
  if (!url) {
    url = URL.createObjectURL(file)
    urls.set(file, url)
  }
  return url
}
