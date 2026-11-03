/** The result of reading one PDF in a bulk upload. */
export interface BulkReadResult {
  fileName: string
  analyses?: Record<string, unknown>[]
  error?: string
}

/** A request to read PDFs that failed as a whole, with the HTTP status of the response. */
export class ReadRequestError extends Error {
  /**
   * @param message - Dutch message for the user.
   * @param status - HTTP status of the response.
   */
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "ReadRequestError"
  }
}

/**
 * Reads soil analysis PDFs with the soil analysis reader. All files go in one request and the
 * results stream back per file, so progress can be shown while the rest is still being read.
 *
 * @param files - The PDFs to read; their names must be unique.
 * @param onResult - Called for every PDF as soon as it has been read or has failed.
 * @throws {ReadRequestError} With a Dutch message when the request as a whole fails.
 */
export async function readSoilAnalysisPdfs(
  files: File[],
  onResult: (result: BulkReadResult) => void,
): Promise<void> {
  const formData = new FormData()
  for (const file of files) formData.append("soilAnalysisFile", file)

  const response = await fetch("/api/soil-analysis/extract", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  })
  if (!response.ok || !response.body) {
    throw new ReadRequestError(
      response.status === 401
        ? "Je sessie is verlopen. Log opnieuw in en probeer het nog eens."
        : "Het uitlezen kon niet worden gestart. Probeer het later opnieuw.",
      response.status,
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const handleLine = (line: string) => {
    if (!line.trim()) return
    try {
      const result = JSON.parse(line) as {
        success: boolean
        filename: string
        analyses?: Record<string, unknown>[]
        error?: string
      }
      onResult(
        result.success
          ? { fileName: result.filename, analyses: result.analyses ?? [] }
          : { fileName: result.filename, error: toReadErrorMessage(result.error) },
      )
    } catch {
      // Ignore a malformed line; the affected file is reported as not read at the end
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) handleLine(line)
  }
  handleLine(buffer)
}

/** Translates an error of the soil analysis reader into a message for the user. */
export function toReadErrorMessage(error: string | undefined): string {
  const message = error ?? ""
  if (/api key/i.test(message)) return "Het uitlezen van PDF's is hier niet beschikbaar."
  if (/depth/i.test(message))
    return "De bemonsteringsdiepte in het rapport kon niet worden gelezen."
  if (/te groot|too large/i.test(message)) return "Het bestand is te groot om uit te lezen."
  return "Dit rapport kon niet worden uitgelezen. Controleer of het van een ondersteund lab komt."
}

/**
 * Adds files to a selection without losing any: the same file twice is kept once, and a different
 * file with a name that is already taken gets a number added, such as `rapport (2).pdf`.
 */
export function mergeUniqueFiles(oldFiles: File[], newFiles: File[]): File[] {
  const result = [...oldFiles]
  const identity = (file: File) => `${file.name}|${file.size}|${file.lastModified}`
  const known = new Set(result.map(identity))
  const names = new Set(result.map((file) => file.name.toLowerCase()))

  for (const file of newFiles) {
    if (known.has(identity(file))) continue
    known.add(identity(file))

    let name = file.name
    if (names.has(name.toLowerCase())) {
      const dot = name.lastIndexOf(".")
      const base = dot > 0 ? name.slice(0, dot) : name
      const extension = dot > 0 ? name.slice(dot) : ""
      let counter = 2
      while (names.has(`${base} (${counter})${extension}`.toLowerCase())) counter++
      name = `${base} (${counter})${extension}`
    }
    names.add(name.toLowerCase())
    result.push(
      name === file.name
        ? file
        : new File([file], name, { type: file.type, lastModified: file.lastModified }),
    )
  }
  return result
}
