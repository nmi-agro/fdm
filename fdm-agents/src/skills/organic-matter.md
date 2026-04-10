# Organic Matter Management

## Goal

Aim for a **positive organic matter balance** (organische stofbalans, `omBalance ≥ 0`) on every field. A positive balance means organic matter is being maintained or built up. A negative balance means organic matter is being depleted.

## Strategy

- Prioritize compost (`p_type: "compost"`) or high-EOM organic fertilizers on fields where the organic matter balance is at risk (negative or close to zero).
- The simulation tool returns `fieldMetrics.omBalance` in kg EOM/ha per field. Positive is better.

## Practical Note

Compost has a long-term soil improvement effect but higher cost. Solid manure (vaste mest) offers a cost-effective alternative with moderate EOM value. When choosing between these, consider the farm's overall organic fertilizer availability and budget context provided by the user.
