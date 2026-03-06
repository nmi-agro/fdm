import Decimal from "decimal.js"

// Helper function to convert Decimal to number recursively
export function convertDecimalToNumberRecursive(data: unknown): unknown {
    if (
        data instanceof Decimal ||
        (typeof data === "object" && data !== null && (data as any).isDecimal)
    ) {
        return (data as Decimal).round().toNumber()
    }
    if (typeof data === "number") {
        return data
    }
    if (Array.isArray(data)) {
        return data.map(convertDecimalToNumberRecursive)
    }
    if (typeof data === "object" && data !== null && !(data instanceof Date)) {
        const newData: { [key: string]: unknown } = {}
        for (const key in data) {
            if (Object.hasOwn(data, key)) {
                const converted = convertDecimalToNumberRecursive(
                    (data as Record<string, unknown>)[key],
                )
                newData[key] = converted
            }
        }
        return newData
    }
    return data
}
