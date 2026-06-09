import type {
    ContentListUnion,
    GenerateContentConfig,
    GenerateContentResponse,
} from "@google/genai"
import { expect } from "vitest"
import { test } from "./test-util"
import {
    DEFAULT_MODEL_CODE,
    TriageAgent,
    type TriageAgentConfig,
} from "./triage"

test.describe("constructor", () => {
    test("should initialize GoogleGenAI", () => {
        const agent = new TriageAgent({ apiKey: "helloworld" })

        expect(agent.ai).toBeDefined()
    })

    test("should set model to default", () => {
        const agent = new TriageAgent({ apiKey: "helloworld" })

        expect(agent.model).toBe(DEFAULT_MODEL_CODE)
    })

    test("should set model to custom", () => {
        const agent = new TriageAgent({
            apiKey: "helloworld",
            model: "gemini-3.5-flash",
        })

        expect(agent.model).toBe("gemini-3.5-flash")
    })

    test("should throw if API key is missing", () => {
        expect(() => new TriageAgent({} as TriageAgentConfig)).toThrow()
    })
})

test.describe("SubjectAndPrioritySchema", async () => {
    let agent: TriageAgent

    interface Captures {
        model?: string
        content?: ContentListUnion
        config?: GenerateContentConfig
    }

    function mockGenerateContent(
        response: string | undefined,
        captures: Captures,
    ) {
        return async ({
            model,
            contents,
            config,
        }: {
            model: string
            contents: ContentListUnion
            config?: GenerateContentConfig
        }) => {
            captures.model = model
            captures.content = contents
            captures.config = config
            return { text: response } as GenerateContentResponse
        }
    }

    test.beforeEach(() => {
        agent = new TriageAgent({ apiKey: "helloworld" })
    })

    test("should return successful response", async () => {
        const captures: Captures = {}
        agent.ai.models.generateContent = mockGenerateContent(
            JSON.stringify({
                subject: "Feature Request",
                priority: "low",
                reasoning: "This was a feature request.",
            }),
            captures,
        )
        const response = await agent.generateSubjectAndPriority(
            "May we have this feature?",
        )
        expect(response).toEqual({
            priority: "low",
            subject: "Feature Request",
            reasoning: "This was a feature request.",
        })
        expect(captures.model).toBe(DEFAULT_MODEL_CODE)
        expect(captures.config).toBeDefined()
        expect(captures.config?.responseMimeType).toBe("application/json")
        expect(captures.config?.responseSchema).toBeUndefined()
        expect(captures.config?.responseJsonSchema).toBeDefined()
    })

    test("should use custom model when provided", async () => {
        const agent = new TriageAgent({
            apiKey: "helloworld",
            model: "gemini-3.5-flash",
        })
        const captures: Captures = {}
        agent.ai.models.generateContent = mockGenerateContent(
            JSON.stringify({
                subject: "Feature Request",
                priority: "low",
                reasoning: "This was a feature request.",
            }),
            captures,
        )
        await agent.generateSubjectAndPriority("May we have this feature?")
        expect(captures.model).toBe("gemini-3.5-flash")
    })

    test("should return preset response if the body is empty", async () => {
        const captures: Captures = {}
        const response = await agent.generateSubjectAndPriority("")
        expect(response).toEqual({
            priority: "low",
            subject: "Empty Message",
            reasoning:
                "The message was empty, so the agents can probably ignore it.",
        })
        expect(captures.model).toBeFalsy()
    })

    test("should throw if the response is invalid JSON", async () => {
        const agent = new TriageAgent({ apiKey: "helloworld" })
        const captures: Captures = {}
        agent.ai.models.generateContent = mockGenerateContent("{", captures)
        await expect(
            agent.generateSubjectAndPriority("May we have this feature?"),
        ).rejects.toThrow()
    })

    test("should throw if the response does not follow the schema", async () => {
        const agent = new TriageAgent({ apiKey: "helloworld" })
        const captures: Captures = {}
        agent.ai.models.generateContent = mockGenerateContent("{}", captures)
        await expect(
            agent.generateSubjectAndPriority("May we have this feature?"),
        ).rejects.toThrow()
    })
})
