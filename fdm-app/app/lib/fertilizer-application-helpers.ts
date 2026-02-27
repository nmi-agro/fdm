/**
 * Takes a comma separated list of b_id:p_app_id pairs and converts it to a list of objects
 *
 * For example, `"a:b,c:d"` would parse into `[{b_id: "a", p_app_id: "b"}, {b_id: "c", p_app_id: "d"}]`
 *
 * Any string separated by `,` that is not a valid pair in the above format is discarded.
 * Therefore, this function might return an empty array even if the string is not empty.
 *
 *
 * @param value string to parse
 * @returns array of objects
 */
export function parseAppIds(value: string) {
    return value
        .split(",")
        .map((pairStr) => pairStr.split(":"))
        .filter(
            (pair) =>
                pair.length === 2 && pair[0].length > 0 && pair[1].length > 0,
        )
        .map(([b_id, p_app_id]) => ({ b_id, p_app_id }))
}
