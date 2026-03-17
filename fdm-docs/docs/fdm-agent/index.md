# FDM Agent

The **FDM Agent** package provides a framework for strategic decision support using Agentic AI. The core philosophy of the FDM Agent is to assist and improve decision-making. While it currently features a single specialized agent, **Gerrit**, the architecture is designed to host a suite of autonomous assistants that help farmers, advisors, and policy makers navigate complex decisions in farm management.

## Philosophy: Usefull Assistance

The FDM Agent is designed to be a collaborative partner. Rather than a "black box" that outputs a fixed result, the agent provides a transparent reasoning process:

- **User Steering**: Users guide the agent's logic through explicit **Planning Strategies** and by providing **Additional Context** (specific wishes or constraints).
- **Transparency**: The agent provides extensive detail on the effects of its choices and how its advice was formed.
- **Informed Decisions**: By surfacing legal deltas, environmental impacts, and agronomic warnings, the agent empowers users to make final, informed management decisions.

## Current Agent: Gerrit (Fertilizer Application Planner)

The primary agent currently available is **Gerrit**, an expert Dutch agronomist designed to generate agronomically sound and legally compliant fertilizer plans for Dutch farms.

### Overview

Fertilizer application planning in the Netherlands is complex due to strict regulatory norms (RVO), environmental targets, and diverse agronomic requirements. Gerrit simplifies this by automating the reasoning required to balance these constraints while optimizing for the user's specific goals.

## Future Expansion

The FDM Agent framework is built to be extensible. Future iterations will introduce additional agents tailored to different personas and management domains.

## Architecture: The Oracle Pattern

The FDM Agent follows a "separation of concerns" architecture often referred to as the **Oracle Pattern**:

1. **Reasoning (The LLM)**: The LLM (Gemini) acts as the brain. It formulates strategies, selects fertilizers, and iterates on the plan based on feedback.
2. **Deterministic Calculation (The Tools)**: All legal and agronomic calculations are handled by the `fdm-calculator` through a set of TypeScript tools. The LLM never performs arithmetic itself; instead, it asks the "Oracle" (the tools) for the exact results of its proposed actions.

### Available Tools

- **`getFarmFields`**: Retrieves all fields for a farm, identifying the "main cultivation" for the year based on the **May 15th rule**.
- **`getFarmNutrientAdvice`**: Fetches detailed agronomic requirements (N, P, K, and other nutrients) based on soil analyses and cultivation.
- **`getFarmLegalNorms`**: Retrieves the three primary legal limits: Animal Manure N, Workable N, and Phosphate.
- **`searchFertilizers`**: Searches the farm's inventory and the catalogue for of available fertilizers.
- **`simulateFarmPlan`**: The core validation tool. It simulates a proposed plan and returns detailed metrics, including:
  - **`complianceIssues`**: Hard legal violations (e.g., exceeding a norm or fertilizing a buffer strip).
  - **`agronomicWarnings`**: Deviations from chosen strategies (e.g., negative organic matter balance).

## Planning Strategies

Users steer Gerrit's reasoning by enabling specific strategies:

- **Organic Farming**: Prohibits the use of all mineral fertilizers.
- **Fill Manure Space**: Instructs the agent to maximize manure usage up to the legal limits, prioritizing local availability of manure.
- **Reduce Ammonia Emissions**: Prioritizes fertilizers and application methods (like injection or incorporation) with lower emission factors for ammonia.
- **Keep Nitrogen Balance Below Target**: Ensures the nitrogen surplus (input minus uptake/loss) remains below environmental target.
- **Work on Rotation Level (Bouwplan)**: Enforces consistency by ensuring all fields with the same cultivation receive identical applications.

## Technical Implementation

### Compliance Logic

Legal compliance is monitored at the **farm aggregate level** (expressed in kg), while agronomic evaluation happens at the **field level** (expressed in kg/ha). The simulation tool automatically area-weights metrics like the Nitrogen Balance to provide accurate farm-level averages.

### Metrics & Nutrients

The agent tracks a comprehensive set of nutrients:

- **Primary**: Nitrogen (N), Phosphate (P₂O₅), Potassium (K₂O).
- **Secondary & Micro**: Calcium (Ca), Magnesium (Mg), Sulfur (S), Copper (Cu), Zinc (Zn), Boron (B), Manganese (Mn), Molybdenum (Mo), and Cobalt (Co).
- **Environmental**: Ammonia emission (NH₃) and Nitrate leaching (NO₃).

### Security

The agent is hardened against **Prompt Injection** using:

- **Input Sanitization**: Removal of structural characters (markdown blocks, XML tags) from user-provided context.
- **Structural Framing**: Encapsulating user input within strict boundary markers in the prompt.
- **Secret Isolation**: API keys (NMI, Gemini) are stored in server-side memory and are never exposed to the LLM's context window.

## Observability

Usage patterns, including selected strategies and additional user context, are logged to **PostHog**. This allows agronomists and developers to analyze how different strategies impact the quality and compliance of generated plans.
