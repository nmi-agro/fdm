import type { McpClientGuide } from "~/lib/mcp-clients"
import { CodeBlock } from "~/components/custom/copy-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

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
            key={index}
            className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs break-all"
          >
            {part}
          </code>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

/**
 * The setup instructions per assistant, one tab each, with copyable snippets.
 */
export function McpClientGuides({ guides }: { guides: McpClientGuide[] }) {
  return (
    <Tabs defaultValue={guides[0]?.id}>
      <TabsList className="h-auto flex-wrap justify-start">
        {guides.map((guide) => (
          <TabsTrigger key={guide.id} value={guide.id}>
            {guide.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {guides.map((guide) => (
        <TabsContent key={guide.id} value={guide.id} className="mt-4 space-y-6">
          {guide.sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h3 className="font-semibold">{section.title}</h3>
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
                  copyLabel={`Kopieer de instellingen voor ${section.title}`}
                />
              )}
              {section.note && <p className="text-muted-foreground text-sm">{section.note}</p>}
            </section>
          ))}
        </TabsContent>
      ))}
    </Tabs>
  )
}
