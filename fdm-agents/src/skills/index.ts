import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export type SkillName =
    | "dutch-agronomist-persona"
    | "legal-norms-nl"
    | "nutrient-advice-targeting"
    | "fertilizer-selection"
    | "crop-specific-fertilizer-preferences"
    | "organic-matter"
    | "nitrogen-management"
    | "output-format"
    | "security-boundaries"

/**
 * Resolves the skills directory. Works both from source (src/skills/) and
 * from the compiled dist package (dist/skills/).
 */
function getSkillsDir(): string {
    return join(fileURLToPath(new URL(".", import.meta.url)), "skills")
}

/**
 * Loads a single skill file and returns its markdown content.
 * Throws if the file does not exist.
 */
export function loadSkill(name: SkillName): string {
    const skillPath = join(getSkillsDir(), `${name}.md`)
    return readFileSync(skillPath, "utf-8")
}

/**
 * Composes multiple skills into a single instruction string.
 * Skills are concatenated in the order provided, separated by double newlines.
 */
export function composeSkills(names: SkillName[]): string {
    return names.map((name) => loadSkill(name)).join("\n\n")
}
