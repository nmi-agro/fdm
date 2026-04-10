# Output Format

## Required JSON Structure

Your final response MUST be a JSON object with exactly this structure. All fields are required unless marked optional.

```json
{
  "summary": "string — Dutch explanation < 250 words",
  "suggestedFollowUps": ["string", "string", "string"],
  "metrics": {
    "farmTotals": {
      "normsFilling": { "manure": number, "nitrogen": number, "phosphate": number },
      "norms": { "manure": number, "nitrogen": number, "phosphate": number },
      "nBalance": {
        "balance": number,
        "target": number,
        "emission": {
          "ammonia": { "total": number },
          "nitrate": { "total": number }
        }
      }
    }
  },
  "plan": [
    {
      "b_id": "string",
      "applications": [
        { "p_id_catalogue": "string", "p_app_amount": number, "p_app_date": "YYYY-MM-DD", "p_app_method": "string" }
      ],
      "fieldMetrics": {
        "advice": {
          "d_n_req": number, "d_p_req": number, "d_k_req": number,
          "d_s_req": number, "d_mg_req": number, "d_ca_req": number, "d_na_req": number,
          "d_cu_req": number, "d_zn_req": number, "d_b_req": number, "d_mn_req": number, "d_mo_req": number, "d_co_req": number
        },
        "proposedDose": {
          "p_dose_n": number, "p_dose_nw": number, "p_dose_p": number, "p_dose_k": number,
          "p_dose_s": number, "p_dose_mg": number, "p_dose_ca": number, "p_dose_na": number,
          "p_dose_cu": number, "p_dose_zn": number, "p_dose_b": number, "p_dose_mn": number, "p_dose_mo": number, "p_dose_co": number
        },
        "normsFilling": {
          "manure": { "normFilling": number, "applicationFilling": [] },
          "nitrogen": { "normFilling": number, "applicationFilling": [] },
          "phosphate": { "normFilling": number, "applicationFilling": [] }
        },
        "norms": {
          "manure": { "normValue": number, "normSource": "string" },
          "nitrogen": { "normValue": number, "normSource": "string" },
          "phosphate": { "normValue": number, "normSource": "string" }
        },
        "omBalance": number,
        "nBalance": { "balance": number, "target": number, "emission": { "ammonia": { "total": number }, "nitrate": { "total": number } } }
      }
    }
  ]
}
```

## Field Rules

- `summary`: Clear, concise Dutch narrative (< 250 words) for farmers and advisors. Explain the reasoning: why these fertilizers, nutrient balance, soil health. Avoid generic openings. Use fertilizer, crop, and field names — never IDs.
- `suggestedFollowUps`: Exactly 3 short Dutch follow-up questions the user might want to ask. Make them specific to this plan (e.g. "Waarom KAS op de zandpercelen?" or "Wat als ik meer drijfmest gebruik?"). These are shown as clickable buttons.
- `metrics.farmTotals`: Copy directly from the final `simulateFarmPlan` result.
- `plan`: Only include fields with at least one application. Buffer strips MUST NOT appear.
- `fieldMetrics`: Copy `advice`, `proposedDose`, `normsFilling`, `norms`, `omBalance`, `nBalance` directly from the `fieldMetrics` object in the final `simulateFarmPlan` result.
- DO NOT include any text before or after the JSON object.

## Calculator Reference

- All per-field nutrient amounts are in **kg/ha**.
- Legal compliance is at **farm level**, not field level.
- `p_app_amount` is always in **kg/ha** regardless of fertilizer type.
- `normsFilling.manure`: total kg N from animal manure applied (farm total in kg, field level in kg/ha).
- `omBalance`: net organic matter balance, kg EOM/ha. Positive = good. Aim for ≥ 0.

## Tool Return Shapes

- `getFarmFields` → `{ fields: [...] }` — each field includes main cultivation details (`b_lu_catalogue`, `b_lu_name`, `b_lu_start`)
- `getFarmNutrientAdvice` → `{ advicePerField: [...] }`
- `getFarmLegalNorms` → `{ normsPerField: [...] }`
- `searchFertilizers` → `{ fertilizers: [...] }`
- `simulateFarmPlan` → `{ fieldResults: [...], farmTotals: {...}, isValid: bool, complianceIssues: [...], agronomicWarnings: [...] }`

If `isValid` is false, read `complianceIssues` — it contains exact messages explaining which norms were violated and by how many kg. Adjust the plan and re-simulate. Read `agronomicWarnings` for soft-limit hints (organic matter, nitrogen targets, manure space).
