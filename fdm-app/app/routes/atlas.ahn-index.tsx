import { data } from "react-router"
import { getAhnIndex } from "@/app/integrations/ahn-cache.server"

export async function loader() {
    const ahnIndex = await getAhnIndex()
    return data(ahnIndex, {
        headers: {
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
    })
}
