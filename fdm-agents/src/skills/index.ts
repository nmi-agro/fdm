import { loadSkillFromDir } from "@google/adk"
import { basename, join } from "node:path"
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
 * from the compiled dist package (dist/index.js bundle → dist/skills/).
 *
 * In source: import.meta.url = .../src/skills/index.ts → "." resolves to src/skills/
 * In bundle: import.meta.url = .../dist/index.js       → "." resolves to dist/
 *            so we must append "skills/" for the bundle case.
 */
function getSkillsDir(): string {
    const here = fileURLToPath(new URL(".", import.meta.url))
    // Strip trailing separator and check whether we are already inside "skills/"
    return basename(here.replace(/[/\\]+$/, "")) === "skills"
        ? here
        : join(here, "skills")
}

/**
 * Loads a single skill by name using the ADK skill loader.
 * Throws if the skill directory or SKILL.md does not exist.
 */
export async function loadSkill(name: SkillName) {
    const skillDir = join(getSkillsDir(), name)
    return loadSkillFromDir(skillDir)
}

/**
 * Composes multiple skills into a single instruction string.
 * Skills are loaded in order and their instructions concatenated, separated by double newlines.
 */
export async function composeSkills(names: SkillName[]): Promise<string> {
    const skills = await Promise.all(names.map((name) => loadSkill(name)))
    return skills.map((s) => s.instructions).join("\n\n")
}

