import type { MetaFunction } from "react-router"
import { clientConfig } from "~/lib/config"

export const meta: MetaFunction = () => {
    return [
        { title: `Privacyvoorwaarden | ${clientConfig.name}` },
        {
            name: "description",
            content: `Bekijk de privacyvoorwaarden van ${clientConfig.name}.`,
        },
    ]
}

export default function PrivacyPage() {
    return (
        <iframe
            src="/privacy/pdf"
            title="Privacyvoorwaarden"
            className="w-full h-screen border-0"
        />
    )
}
