/**
 * Handle any errors that might occur during input collection for one or multiple farms or a field.
 *
 * It will wrap the error with a new error with a descriptive message if it was an unexpected error.
 *
 * @param error error to wrap and return or return as it is
 * @param b_id_farm farm ID if the error occurs in the context of input collection for a specific farm
 * @returns a wrapped error or the input error itself. The returned error is guaranteed to have a descriptive message.
 */
export const handleInputCollectionError =
    (failedToCollectForFarmMessage: string, failedToCollectMessage: string) =>
    (error: unknown, b_id_farm?: string) => {
        if (
            error instanceof Error &&
            (error.message?.startsWith(failedToCollectForFarmMessage) ||
                error.message?.startsWith(failedToCollectMessage))
        ) {
            return error
        }
        // Wrap any errors in a more descriptive error message.
        return new Error(
            b_id_farm
                ? `${failedToCollectForFarmMessage} ${b_id_farm}: ${
                      error instanceof Error ? error.message : String(error)
                  }`
                : `${failedToCollectMessage}: ${
                      error instanceof Error ? error.message : String(error)
                  }`,
            { cause: error },
        )
    }
