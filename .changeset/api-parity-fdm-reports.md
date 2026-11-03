---
"@nmi-agro/fdm-reports": minor
---

New package with the yearly fertilizer plan (bemestingsplan): collecting its data, calculating it, rendering the PDF, storing it (`establishFertilizerPlan`) and checking whether a saved plan still matches the current data (`createFertilizerPlanStatusChecker`). The PDF is uploaded before the plan is saved, so a plan always has a file. The input hash includes the version of this package and of fdm-calculator, so plans are reported as outdated when the calculation changes.
