import type { Message as MessageT } from "@nmi-agro/fdm-helpdesk"
import { Card } from "~/components/ui/card"

export function Message({ message }: { message: MessageT }) {
    return (
        <Card className="flex flex-row">
            <div className="grow">
                <p className="text-muted-foreground">
                    {message.sender_name ?? "Onbekende Verzender"}
                </p>
                <p>{message.body}</p>
            </div>
        </Card>
    )
}
