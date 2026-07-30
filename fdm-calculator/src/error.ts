/**
 * Thrown when a norm calculation cannot produce a result because the required
 * input data is absent or the cultivation has no applicable norm entry. This is
 * an expected domain condition, not an infrastructure failure.
 */
export class NormNotApplicableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NormNotApplicableError"
  }
}
