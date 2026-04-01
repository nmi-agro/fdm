/* v8 ignore start -- @preserve */
import type { FdmType } from "./fdm"

/**
 * Returns a proxy for the fdm instance which throws an exception when selecting from the given table
 *
 * @param fdm fdm instance to proxy
 * @param tableToThrowOn schema table to throw on
 * @param errorMessage what message to throw. By default, "Error querying the database" is thrown.
 * @returns a proxied fdm instance that can be used just like the given fdm instance
 */
export function mockFdmThatThrowsOnSelectFrom(
    fdm: FdmType,
    tableToThrowOn: unknown,
    errorMessage = "Error querying the database",
) {
    return new Proxy(fdm, {
        get(target, property, receiver) {
            if (property !== "select") {
                return Reflect.get(target, property, receiver)
            }

            return (...args: []) => {
                const query = target.select(...args)

                return new Proxy(query, {
                    get(queryTarget, queryProperty, queryReceiver) {
                        if (queryProperty !== "from") {
                            return Reflect.get(
                                queryTarget,
                                queryProperty,
                                queryReceiver,
                            )
                        }

                        return (table: unknown) => {
                            if (table === tableToThrowOn) {
                                throw new Error(errorMessage)
                            }

                            const from = Reflect.get(queryTarget, "from") as (
                                table: unknown,
                            ) => unknown
                            return from.call(queryTarget, table)
                        }
                    },
                })
            }
        },
    }) as typeof fdm
}
/* v8 ignore stop -- @preserve */
