import type { CallToolResult } from "@modelcontextprotocol/server"
import { classifyError, consumeRateLimit } from "@nmi-agro/fdm-api"
import * as Sentry from "@sentry/node"
import type { McpTool, ToolContext } from "./tools/types"

/**
 * Turns a failure into a message the model can act on. Messages of known failures come from the
 * operations; unexpected failures only give an error id, never internal details.
 */
function errorMessage(err: unknown): { message: string; status: number } {
  const { status, detail, errorId } = classifyError(err)
  if (status >= 500 && errorId) {
    return { status, message: `${detail} Error id: ${errorId}.` }
  }
  return { status, message: detail }
}

/** Builds an error result, which MCP clients show to the model instead of a protocol error. */
function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] }
}

/**
 * Runs a tool for the principal: counts the call in the tool's rate-limit bucket (shared with the
 * REST API), runs the operation and returns a structured result. Failures become a result with
 * `isError: true` and a message the model can act on, not a protocol error.
 *
 * Only the tool name and the outcome are logged and sent to Sentry, never the arguments or the
 * result, because those contain farm data.
 *
 * @param tool - The tool to run.
 * @param ctx - Database, services and principal.
 * @param args - Arguments, already validated against `tool.input`.
 * @returns The tool result.
 */
export async function callTool(
  tool: McpTool,
  ctx: ToolContext,
  args: unknown,
): Promise<CallToolResult> {
  Sentry.setTag("mcp.tool", tool.name)
  const started = Date.now()
  try {
    const limit = await consumeRateLimit(ctx.fdm, ctx.principal.apiKeyId, tool.bucket)
    if (!limit.allowed) {
      logOutcome(tool.name, "rate-limited", started)
      return errorResult(
        `Rate limit exceeded: at most ${limit.limit} ${tool.bucket} requests per minute for this API key. Retry after ${limit.resetIn} s.`,
      )
    }
    const result = await tool.run(ctx, args)
    // Validate against the output schema, which also drops properties the schema does not
    // declare. A mismatch is a bug in the schema or the operation: report where, never what.
    const parsed = tool.output.safeParse(result)
    if (!parsed.success) {
      // Collapse array indices, so a mismatch in every item of a list is reported once.
      const paths = [
        ...new Set(
          parsed.error.issues.map(
            (issue) =>
              issue.path.map((part) => (typeof part === "number" ? "*" : String(part))).join(".") ||
              "(root)",
          ),
        ),
      ]
      const errorId = Sentry.captureMessage(
        `MCP tool result does not match its output schema: ${tool.name} at ${paths.join(", ")}`,
        "error",
      )
      logOutcome(tool.name, `error output-schema at ${paths.join(", ")}`, started)
      return errorResult(`An unexpected error occurred. Error id: ${errorId}.`)
    }
    const structured = parsed.data as Record<string, unknown>
    logOutcome(tool.name, "ok", started)
    return {
      content: [{ type: "text", text: JSON.stringify(structured) }],
      structuredContent: structured,
    }
  } catch (err) {
    const { message, status } = errorMessage(err)
    logOutcome(tool.name, `error ${status}`, started)
    return errorResult(message)
  }
}

function logOutcome(tool: string, outcome: string, started: number): void {
  console.info(`[fdm-mcp] tool=${tool} outcome="${outcome}" duration_ms=${Date.now() - started}`)
}
