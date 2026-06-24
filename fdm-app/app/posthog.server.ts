import { PostHog } from "posthog-node"

let posthogClient: PostHog | null = null

export default function PostHogClient(): PostHog | null {
    if (!posthogClient) {
        const posthogHost = process.env.PUBLIC_POSTHOG_HOST
        const posthogKey = process.env.PUBLIC_POSTHOG_KEY
        if (posthogHost && posthogKey?.startsWith("phc")) {
            posthogClient = new PostHog(posthogKey, {
                host: posthogHost,
                // Send events one at a time to avoid 413s from large LLM
                // payloads (reasoning traces + tool results can be sizeable).
                maxBatchSize: 1,
            })
        }
    }
    return posthogClient
}
