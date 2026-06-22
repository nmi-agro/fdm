# FDM Agents (`fdm-agents`)

The `fdm-agents` package provides a framework for strategic decision support using Agentic AI. It enables the creation of specialized autonomous assistants that help farmers, advisors, and policy makers navigate complex decisions in farm management by combining the reasoning power of Large Language Models (LLMs) with the deterministic accuracy of the Farm Data Model.

## Philosophy: Decision Support, Not Automation

The core mission of `fdm-agents` is to **assist and improve decision-making**, rather than fully automating it. The agent acts as a collaborative partner:

- **User Steering:** Users guide the agent through explicit strategies and additional context.
- **Transparency:** The agent provides detailed explanations of its reasoning (*"hoe het advies tot stand is gekomen"*) and the effects of its choices.
- **Informed Choices:** By surfacing legal deltas, environmental impacts, and agronomic warnings, the agent empowers users to make final management decisions with full confidence.

## Agents

### Gerrit - The Fertilizer Application Planning Agent
An expert Dutch agronomist agent specialized in generating agronomically sound and legally compliant fertilizer application plans.
- **The Reasoner-Verifier Architecture:** A robust separation between LLM reasoning and deterministic calculations. The agent uses specialized tools to query the `fdm-calculator` for exact regulatory and agronomic results.
- **Strategic Optimization:** Built-in support for multiple farm strategies such as Organic Farming, Ammonia Reduction, and Rotation-level consistency (Bouwplan).
- **Comprehensive Compliance:** Automatically verifies plans against Dutch RVO legal norms at the farm aggregate level while evaluating agronomic needs at the field level.
- **Environmental Impact Tracking:** Monitors and reports on nitrogen balances, ammonia emissions (NH₃), and nitrate leaching (NO₃).
- **Security First:** Hardened against prompt injection attacks using robust input sanitization and structural framing.

### Ticket Triage Agent
Generates subject lines and estimates priorities for user messages sent to the FDM application support team.
- **Time Save for The Support Team** By estimating priorities for different user questions and requests, it lets the support team focus on the most important matters first.
- **Transparent:** Always explains its decisions for different user messages, providing valuable insight to the service provider and enabling future improvements to the triage agent.
- **Security First:** Hardened against prompt injection attacks using robust input sanitization and structural framing.

## Getting Started

### Installation

```bash
pnpm add @nmi-agro/fdm-agents
```

### Usage

The package provides high-level APIs to trigger agent executions. You will need a Gemini API key and, depending on the tools used, access to the NMI API.

#### Fertilizer Planning (Gerrit)

```typescript
import { generateFarmFertilizerPlan } from "@nmi-agro/fdm-agents";

const plan = await generateFarmFertilizerPlan(
    fdm,
    principalId,
    farmData,
    {
        isOrganic: false,
        fillManureSpace: true,
        reduceAmmoniaEmissions: true,
        keepNitrogenBalanceBelowTarget: true,
        workOnRotationLevel: true,
    },
    "2025",
    process.env.GEMINI_API_KEY,
    process.env.NMI_API_KEY,
    "Gebruik bij voorkeur eigen drijfmest op de huiskavel."
);
```

#### Ticket Triage

`generateTicketSubjectAndPriority` takes a raw support ticket message and returns a
structured triage result with a subject line, a priority level, and the model's reasoning.

**Priority levels:**

| Level | Criteria |
|-------|----------|
| `urgent` | System down, data loss, or blocking farm operations **right now** |
| `high` | Major feature broken, incorrect calculations, can't access critical data |
| `normal` | General questions, minor bugs, feature requests, how-to questions |
| `low` | Nice-to-have improvements, cosmetic issues, feedback |

```typescript
import { generateTicketSubjectAndPriority } from "@nmi-agro/fdm-agents";

const result = await generateTicketSubjectAndPriority(
    "Ik kan mijn percelen niet meer inzien, de pagina laadt niet.",
    process.env.GEMINI_API_KEY,
);
/*
{
    subject: "Kan percelen niet inzien: pagina laadt niet",
    priority: "high",
    reasoning: "The user is unable to access their parcel data, which is a core function of the platform. This is a blocking issue for their work."
}
*/
```

## Architecture: The Reasoner-Verifier Architecture

To ensure 100% regulatory accuracy, `fdm-agents` uses the **Reasoner-Verifier Architecture**:

1. **Reasoning (The LLM):** Formulates the plan, selects fertilizers, and handles the expert narrative.
2. **Deterministic Calculation (The Tools):** All math and rule-following (e.g., werkingscoëfficiënten, soil-specific norms) are handled by TypeScript tools calling `fdm-calculator`.

The LLM never performs arithmetic itself; it proposes actions and asks the tools for the precise legal and agronomic results.

## Security

`fdm-agents` implements multiple layers of defense against malicious input:

- **Character Sanitization:** Neutralizes Markdown code blocks and strips XML/HTML tags from user input.
- **Structural Framing:** Encapsulates user context within strict boundary markers in the system prompt.
- **Secret Isolation:** API keys and sensitive environment variables remain strictly server-side and are never transmitted to the LLM context.

## Made Possible By

FDM is developed by the [Nutriënten Management Instituut](https://www.nmi-agro.nl/) as part of the Horizon Europe projects: [NutriBudget](https://www.nutribudget.eu/) and [PPS BAAT](https://www.handboekbodemenbemesting.nl/nl/handboekbodemenbemesting/pps-baat.htm).

## Contact

Maintainer: @SvenVw
Reviewer: @gerardhros
