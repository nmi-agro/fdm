export function splitBy<T>(
    items: T[],
    fn: (obj: T) => string,
): Record<string, T[]> {
    const result: Record<string, T[]> = {}
    if (items && items.length > 0) {
        let start = 0
        let end = 0
        while (end < items.length) {
            const currentKey = fn(items[start])
            for (; end < items.length; end++) {
                if (fn(items[end]) !== currentKey) break
            }
            result[currentKey] = items.slice(start, end)
            start = end
        }
    }
    return result
}
