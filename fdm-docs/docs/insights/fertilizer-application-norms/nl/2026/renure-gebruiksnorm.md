---
title: Renure gebruiksnorm 2026
sidebar_label: "Renure gebruiksnorm"
---

This document explains the Renure usage norm (`gebruiksnorm`), which is new in 2026, and how applied Renure products count towards it (`opvulling`).

---

## What Is Renure?

**Renure** stands for "REcovered Nitrogen from manURE": nitrogen products recovered from animal manure through processing. Because their nitrogen behaves more like mineral fertilizer than like raw manure, Renure is treated separately from ordinary animal manure.

Renure was not legally recognised in the Netherlands before 2026.

---

## Calculating the Gebruiksnorm (Usage Norm)

### How the Norm Works

Renure is **exempt from the 170 kg N/ha animal manure norm** and instead has its own ceiling:

- **80 kg N/ha from Renure**, on top of the animal manure norm.

Renure still counts in full toward the [nitrogen usage norm](./stikstofgebruiksnorm.md) and the [phosphate usage norm](./fosfaatgebruiksnorm.md). The Renure norm is therefore an additional ceiling, not additional total nutrient space: a field can receive up to 170 kg N/ha from animal manure plus up to 80 kg N/ha from Renure, but the combined nitrogen and phosphate must still fit within those two norms.

A field marked as a buffer strip (`b_bufferstrip`) receives a norm of 0.

### How the FDM Calculator Determines the Norm

The `fdm-calculator` uses the `calculateNL2026RenureGebruiksNorm` function in `fdm-calculator/src/norms/nl/2026/value/renure-gebruiksnorm.ts`. The norm is a flat 80 kg N/ha and does not depend on soil region, `NV-gebied` status or crop.

---

## Calculating the Opvulling (Filling)

### How the Filling Works

Only fertilizers classified as Renure fill this norm. Classification follows the RVO manure code (`mestcode`): codes **130 to 134** are Renure. Every other fertilizer contributes nothing to this norm.

The filling uses the **total nitrogen** applied, with no efficiency coefficient:

`Total Nitrogen (kg N) = Applied Amount (ton) × Total Nitrogen Content (kg N/ton)`

If a specific analysis value for the nitrogen content (`p_n_rt`) is known, it is used; otherwise it falls back to 0 when it is missing for RVO codes 130–134 (as Tabel 11 has no forfaitair nitrogen content for Renure codes). Any cumulative Renure nitrogen above 80 kg N/ha spills over to the [animal manure usage norm](./dierlijke-mest-gebruiksnorm.md).

### How the FDM Calculator Determines the Filling

The `calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm` function in `fdm-calculator/src/norms/nl/2026/filling/renure-gebruiksnorm.ts` relies on:

- The applied amount of the fertilizer.
- The `p_type_rvo` manure code of the fertilizer.
- The `p_type_renure` flag and nitrogen values in `fdm-calculator/src/norms/nl/2026/filling/table-11-mestcodes.ts`.

Applications of fertilizers that are not Renure are included in the breakdown with a filling of 0, so the result shows every application considered.
