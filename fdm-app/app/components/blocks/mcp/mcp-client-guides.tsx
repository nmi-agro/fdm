import { ChevronDownIcon } from "lucide-react"
import type { McpClientGuides as McpClientGuidesData, McpGuideSection } from "~/lib/mcp-clients"
import { CodeBlock } from "~/components/custom/copy-button"
import { Button } from "~/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { MCP_KEY_HEADER, MCP_KEY_PLACEHOLDER } from "~/lib/mcp-clients"

/**
 * Shows text in which parts between backticks are code, such as an address or a header name.
 */
function TextWithCode({ text }: { text: string }) {
  const parts = text.split("`")
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <code
            // The parts of one fixed text never change order, so the index is a stable key.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs [overflow-wrap:anywhere]"
          >
            {part}
          </code>
        ) : (
          // oxlint-disable-next-line react/no-array-index-key
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

/**
 * One way to connect: a title, an optional intro, numbered steps, a snippet to copy and a note.
 */
function GuideSection({ section }: { section: McpGuideSection }) {
  return (
    <section className="space-y-3">
      <h5 className="text-sm font-semibold">{section.title}</h5>
      {section.intro && (
        <p className="text-sm">
          <TextWithCode text={section.intro} />
        </p>
      )}
      {section.steps && (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {section.steps.map((step) => (
            <li key={step}>
              <TextWithCode text={step} />
            </li>
          ))}
        </ol>
      )}
      {section.code && (
        <CodeBlock
          code={section.code.text}
          copyContext={`instellingen voor ${section.title}`}
          highlight={MCP_KEY_PLACEHOLDER}
        />
      )}
      {section.note && <p className="text-muted-foreground text-sm">{section.note}</p>}
    </section>
  )
}

/**
 * The setup instructions: first the way most users connect (claude.ai and Claude Desktop), then the
 * assistants that cannot connect yet, and folded away the instructions for developers and local
 * models, one tab per group.
 */
export function McpClientGuides({ guides }: { guides: McpClientGuidesData }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <GuideSection section={guides.primary} />
        <p className="text-muted-foreground text-sm">
          Namen tussen aanhalingstekens zijn knoppen en menu's in Claude. In jouw versie kunnen ze
          anders heten.
        </p>
      </div>

      {guides.unsupported.length > 0 && (
        <div className="space-y-1 text-sm">
          {guides.unsupported.map((client) => (
            <p key={client.label}>
              <span className="font-medium">{client.label} werkt nog niet.</span>{" "}
              <span className="text-muted-foreground">{client.reason}</span>
            </p>
          ))}
        </div>
      )}

      <Collapsible className="border-t pt-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="group -ml-3 h-auto py-1.5">
            <ChevronDownIcon className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
            <span>Voor ontwikkelaars en lokale modellen</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          <p className="text-muted-foreground text-sm">
            Claude Code, Codex, de OpenAI API en lokale modellen stel je in op een computer. Ze
            vragen om het adres en de header{" "}
            <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs">
              {MCP_KEY_HEADER}
            </code>{" "}
            met je sleutel als waarde. Vraagt een programma om een &quot;Bearer token&quot;, vul
            daar dan je sleutel in. Vervang{" "}
            <mark className="bg-background text-foreground ring-border rounded px-0.5 font-mono text-xs font-semibold ring-1">
              {MCP_KEY_PLACEHOLDER}
            </mark>{" "}
            in de voorbeelden door je sleutel, zonder de punthaken.
          </p>
          <Tabs defaultValue={guides.developer[0]?.id}>
            <TabsList className="h-auto flex-wrap justify-start">
              {guides.developer.map((guide) => (
                <TabsTrigger key={guide.id} value={guide.id}>
                  {guide.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {guides.developer.map((guide) => (
              <TabsContent key={guide.id} value={guide.id} className="mt-4 space-y-6">
                {guide.sections.map((section) => (
                  <GuideSection key={section.title} section={section} />
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
