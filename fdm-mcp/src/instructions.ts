/**
 * Builds the server instructions: guidance for the model on how to use the tools well and safely.
 * Clients add them to the model's context when they connect.
 *
 * @param appName - Public name of the application, for example "FDM".
 * @returns The instructions.
 */
export function buildInstructions(appName: string): string {
  return [
    `${appName} holds the farm data of the user: farms, fields, cultivations, harvests, fertilizers, fertilizer applications, soil analyses and measures, and calculates nutrient balances, fertilization norms and advice from them. You act as the user, with their permissions.`,
    "",
    "- Look data up before you change it. Start with `list_farms` to find the `b_id_farm`, then list the fields, cultivations or other records to find their ids.",
    "- Never guess codes for cultivations, fertilizers or measures. Look them up in the catalogue tools.",
    "- Coded values, such as `p_app_method` or `b_acquiring_method`, are English or numeric codes, while the user knows the Dutch names that the web app shows. The schema descriptions list each code with that name: map the user's words to a code through those names, and use the name, not the code, when you talk to the user. When no name clearly fits, ask the user instead of guessing.",
    "- Always ask the user to confirm before you delete anything. Deletes are permanent and also remove the records that depend on the deleted one.",
    "- Dates are YYYY-MM-DD. Quantities use metric units, such as kg/ha, ha and kg N/ha; the tool descriptions and schemas give the unit of each value.",
    "- List tools return pages: pass `next_cursor` as `cursor` to get the next page.",
    "- The server cannot receive or return files. When the user gives you a lab report, read the values yourself, show them to the user to check, and then save them with `create_soil_analysis`. To import fields from an RVO shapefile or lab reports as files, the user can use the web app.",
    "- A failed tool call explains what went wrong, for example a missing record or a rate limit with the seconds to wait. Use it to correct the call or tell the user.",
    "- Answer in the language of the user. Present calculation results as information, not as binding advice: the user stays responsible for decisions.",
  ].join("\n")
}
