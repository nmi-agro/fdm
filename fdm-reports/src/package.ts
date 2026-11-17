import packageJson from "../package.json" with { type: "json" }

/**
 * Version information of this package, read from its `package.json`. It is part of the input
 * hash of a fertilizer plan, so plans made with an older version are reported as outdated.
 */
export default {
  version: packageJson.version,
}
