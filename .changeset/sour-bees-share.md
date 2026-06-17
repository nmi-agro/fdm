---
"@nmi-agro/fdm-calculator": minor
---

Document and expose official BLN3 aggregation results in calculation types.

- **Expose Aggregations**: Explicitly documents and types `Bln3AggregationResult` and the `Bln3Score.aggregations` field as fully implemented and returned by the NMI API.
- **Reduces Overhead**: Developers consuming this package can now pull pre-computed official hierarchical aggregations (such as OBI subcategories and the S_BLN root score) directly from the API response payload without needing to write or maintain approximate client-side formulas.
