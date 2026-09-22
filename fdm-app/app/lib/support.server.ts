import { generateTicketSubjectAndPriority } from "@nmi-agro/fdm-agents"
import { updateTicketSubjectAndPriorityUnchecked } from "@nmi-agro/fdm-helpdesk"
import { AttachmentGridItem } from "~/components/blocks/helpdesk/attachment-grid"
import { clientConfig } from "./config"
import { handleActionError } from "./error"
import { fdm } from "./fdm.server"

export async function performTicketTriage(
  apiKey: string,
  ticket_id: string,
  body: string,
  attachments?: AttachmentGridItem[],
) {
  try {
    const { subject, priority, reasoning } = await generateTicketSubjectAndPriority(
      body,
      attachments,
      apiKey,
      clientConfig.name,
    )

    console.log(reasoning)

    await updateTicketSubjectAndPriorityUnchecked(fdm, ticket_id, subject, priority)
  } catch (triageError) {
    void handleActionError(triageError)
  }
}
